-- Transactional, idempotent CRM writes exposed through MCP.

create or replace function public.mcp_create_crm_record(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_actor_user_id uuid,
  p_tool_name text,
  p_idempotency_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
  existing_result jsonb;
  final_result jsonb;
  record_id uuid;
  linked_company uuid;
  linked_contact uuid;
  linked_deal uuid;
begin
  if p_tool_name not in ('create_contact', 'create_lead', 'create_task') then
    raise exception 'Unsupported MCP CRM tool';
  end if;
  if char_length(p_idempotency_key) not between 8 and 120 then
    raise exception 'Invalid idempotency key';
  end if;
  if not exists (
    select 1 from public.mcp_connections
    where id = p_connection_id and workspace_id = p_workspace_id
      and status = 'active' and scopes @> array['crm:write']::text[]
  ) then
    raise exception 'MCP connection is not authorized';
  end if;

  insert into public.mcp_idempotency_keys (workspace_id, connection_id, tool_name, idempotency_key, result)
  values (p_workspace_id, p_connection_id, p_tool_name, p_idempotency_key, jsonb_build_object('status', 'processing'))
  on conflict (connection_id, tool_name, idempotency_key) do nothing
  returning id into claimed_id;

  if claimed_id is null then
    select result into existing_result from public.mcp_idempotency_keys
    where connection_id = p_connection_id and tool_name = p_tool_name and idempotency_key = p_idempotency_key;
    if existing_result ->> 'status' = 'processing' then raise exception 'This MCP request is still processing'; end if;
    return existing_result || jsonb_build_object('replayed', true);
  end if;

  linked_company := nullif(p_payload ->> 'companyId', '')::uuid;
  linked_contact := nullif(p_payload ->> 'contactId', '')::uuid;
  linked_deal := nullif(p_payload ->> 'dealId', '')::uuid;
  if linked_company is not null and not exists (select 1 from public.companies where id = linked_company and workspace_id = p_workspace_id) then raise exception 'Company not found in this workspace'; end if;
  if linked_contact is not null and not exists (select 1 from public.contacts where id = linked_contact and workspace_id = p_workspace_id) then raise exception 'Contact not found in this workspace'; end if;
  if linked_deal is not null and not exists (select 1 from public.deals where id = linked_deal and workspace_id = p_workspace_id) then raise exception 'Deal not found in this workspace'; end if;

  if p_tool_name = 'create_contact' then
    insert into public.contacts (workspace_id, company_id, first_name, last_name, display_name, email, phone, job_title, linkedin_url, notes, owner_user_id)
    values (p_workspace_id, linked_company, coalesce(p_payload ->> 'firstName', ''), coalesce(p_payload ->> 'lastName', ''), p_payload ->> 'displayName', coalesce(p_payload ->> 'email', ''), coalesce(p_payload ->> 'phone', ''), coalesce(p_payload ->> 'jobTitle', ''), coalesce(p_payload ->> 'linkedinUrl', ''), coalesce(p_payload ->> 'notes', ''), p_actor_user_id)
    returning id into record_id;
  elsif p_tool_name = 'create_lead' then
    insert into public.leads (workspace_id, company_id, contact_id, owner_user_id, status, source, score, score_reason, next_action_at)
    values (p_workspace_id, linked_company, linked_contact, p_actor_user_id, coalesce(p_payload ->> 'status', 'new'), coalesce(p_payload ->> 'source', 'MCP'), nullif(p_payload ->> 'score', '')::integer, nullif(p_payload ->> 'scoreReason', ''), nullif(p_payload ->> 'nextActionAt', '')::timestamptz)
    returning id into record_id;
  else
    insert into public.tasks (workspace_id, assigned_to, deal_id, company_id, contact_id, type, title, description, priority, due_at, created_by)
    values (p_workspace_id, p_actor_user_id, linked_deal, linked_company, linked_contact, coalesce(p_payload ->> 'type', 'follow_up'), p_payload ->> 'title', nullif(p_payload ->> 'description', ''), coalesce(p_payload ->> 'priority', 'medium'), nullif(p_payload ->> 'dueAt', '')::timestamptz, p_actor_user_id)
    returning id into record_id;
  end if;

  final_result := jsonb_build_object('id', record_id, 'type', p_tool_name, 'createdAt', now());
  update public.mcp_idempotency_keys set result = final_result where id = claimed_id;
  return final_result;
end;
$$;

revoke all on function public.mcp_create_crm_record(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_create_crm_record(uuid, uuid, uuid, text, text, jsonb) to service_role;
