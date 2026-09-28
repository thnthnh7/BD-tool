-- Production hardening for MCP writes and approval lifecycle.

create or replace function public.mcp_create_company(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_company jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
  existing_result jsonb;
  company_row public.companies%rowtype;
  final_result jsonb;
begin
  if char_length(p_idempotency_key) not between 8 and 120 then
    raise exception 'Invalid idempotency key';
  end if;

  if not exists (
    select 1 from public.mcp_connections
    where id = p_connection_id
      and workspace_id = p_workspace_id
      and status = 'active'
      and scopes @> array['crm:write']::text[]
  ) then
    raise exception 'MCP connection is not authorized';
  end if;

  insert into public.mcp_idempotency_keys (
    workspace_id, connection_id, tool_name, idempotency_key, result
  ) values (
    p_workspace_id, p_connection_id, 'create_company', p_idempotency_key,
    jsonb_build_object('status', 'processing')
  )
  on conflict (connection_id, tool_name, idempotency_key) do nothing
  returning id into claimed_id;

  if claimed_id is null then
    select result into existing_result
    from public.mcp_idempotency_keys
    where connection_id = p_connection_id
      and tool_name = 'create_company'
      and idempotency_key = p_idempotency_key;

    if existing_result ->> 'status' = 'processing' then
      raise exception 'This MCP request is still processing';
    end if;
    return existing_result || jsonb_build_object('replayed', true);
  end if;

  insert into public.companies (
    workspace_id, owner_user_id, name, website, industry, email, phone, notes
  ) values (
    p_workspace_id,
    p_actor_user_id,
    nullif(trim(p_company ->> 'name'), ''),
    coalesce(p_company ->> 'website', ''),
    coalesce(p_company ->> 'industry', ''),
    coalesce(p_company ->> 'email', ''),
    coalesce(p_company ->> 'phone', ''),
    coalesce(p_company ->> 'notes', '')
  )
  returning * into company_row;

  final_result := jsonb_build_object(
    'id', company_row.id,
    'name', company_row.name,
    'website', company_row.website,
    'industry', company_row.industry,
    'email', company_row.email,
    'phone', company_row.phone,
    'created_at', company_row.created_at
  );

  update public.mcp_idempotency_keys
  set result = final_result
  where id = claimed_id;

  return final_result;
end;
$$;

create or replace function public.expire_mcp_action_requests(p_workspace_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.mcp_action_requests
  set status = 'expired', completed_at = now()
  where status = 'pending'
    and expires_at <= now()
    and (p_workspace_id is null or workspace_id = p_workspace_id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.notify_mcp_action_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select
      new.workspace_id,
      member.user_id,
      'MCP approval required',
      case new.action_type
        when 'start_maps_scrape' then 'An AI client requested a paid scrape run.'
        else 'An AI client requested an action that needs approval.'
      end,
      'warning',
      'mcp_action_request',
      new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id
      and member.role in ('owner', 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists mcp_action_requests_notify on public.mcp_action_requests;
create trigger mcp_action_requests_notify
after insert on public.mcp_action_requests
for each row execute function public.notify_mcp_action_request();

revoke all on function public.mcp_create_company(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_mcp_action_requests(uuid) from public, anon, authenticated;
grant execute on function public.mcp_create_company(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.expire_mcp_action_requests(uuid) to service_role;
