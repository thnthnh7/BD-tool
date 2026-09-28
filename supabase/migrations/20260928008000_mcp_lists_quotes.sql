-- Idempotent list membership and quote draft creation for MCP.

create or replace function public.mcp_create_sales_artifact(
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
  target_id uuid;
  company_id uuid;
  list_id uuid;
  deal_id uuid;
begin
  if p_tool_name not in ('add_company_to_list', 'create_quote_draft') then raise exception 'Unsupported MCP sales artifact'; end if;
  if char_length(p_idempotency_key) not between 8 and 120 then raise exception 'Invalid idempotency key'; end if;
  if not exists (select 1 from public.mcp_connections where id = p_connection_id and workspace_id = p_workspace_id and status = 'active') then raise exception 'MCP connection is not authorized'; end if;
  if p_tool_name = 'add_company_to_list' and not exists (select 1 from public.mcp_connections where id = p_connection_id and scopes @> array['crm:write']::text[]) then raise exception 'crm:write scope is required'; end if;
  if p_tool_name = 'create_quote_draft' and not exists (select 1 from public.mcp_connections where id = p_connection_id and scopes @> array['quotes:write']::text[]) then raise exception 'quotes:write scope is required'; end if;

  insert into public.mcp_idempotency_keys (workspace_id, connection_id, tool_name, idempotency_key, result)
  values (p_workspace_id, p_connection_id, p_tool_name, p_idempotency_key, jsonb_build_object('status', 'processing'))
  on conflict (connection_id, tool_name, idempotency_key) do nothing returning id into claimed_id;
  if claimed_id is null then
    select result into existing_result from public.mcp_idempotency_keys where connection_id = p_connection_id and tool_name = p_tool_name and idempotency_key = p_idempotency_key;
    if existing_result ->> 'status' = 'processing' then raise exception 'This MCP request is still processing'; end if;
    return existing_result || jsonb_build_object('replayed', true);
  end if;

  if p_tool_name = 'add_company_to_list' then
    company_id := (p_payload ->> 'companyId')::uuid;
    list_id := (p_payload ->> 'listId')::uuid;
    if not exists (select 1 from public.companies where id = company_id and workspace_id = p_workspace_id) then raise exception 'Company not found in this workspace'; end if;
    if not exists (select 1 from public.lead_lists where id = list_id and workspace_id = p_workspace_id) then raise exception 'List not found in this workspace'; end if;
    insert into public.lead_list_members (workspace_id, list_id, company_id, lead_id, contact_id, added_from)
    values (p_workspace_id, list_id, company_id, nullif(p_payload ->> 'leadId', '')::uuid, nullif(p_payload ->> 'contactId', '')::uuid, 'crm')
    on conflict (list_id, company_id) do update set lead_id = coalesce(excluded.lead_id, lead_list_members.lead_id), contact_id = coalesce(excluded.contact_id, lead_list_members.contact_id)
    returning id into target_id;
  else
    deal_id := nullif(p_payload ->> 'dealId', '')::uuid;
    if deal_id is not null and not exists (select 1 from public.deals where id = deal_id and workspace_id = p_workspace_id) then raise exception 'Deal not found in this workspace'; end if;
    insert into public.quotes (workspace_id, public_id, title, project_type, status, currency, items, discount, vat_rate, valid_until, project_overview, timeline, next_steps, deal_id, quote_status_v2)
    values (p_workspace_id, 'Q-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), coalesce(p_payload ->> 'title', ''), coalesce(p_payload ->> 'projectType', 'Custom project'), 'draft', coalesce(p_payload ->> 'currency', 'USD'), coalesce(p_payload -> 'items', '[]'::jsonb), coalesce(nullif(p_payload ->> 'discount', '')::numeric, 0), coalesce(nullif(p_payload ->> 'vatRate', '')::numeric, 0), nullif(p_payload ->> 'validUntil', '')::date, coalesce(p_payload ->> 'projectOverview', ''), coalesce(p_payload ->> 'timeline', ''), coalesce(p_payload ->> 'nextSteps', ''), deal_id, 'draft')
    returning id into target_id;
  end if;
  final_result := jsonb_build_object('id', target_id, 'type', p_tool_name, 'createdAt', now());
  update public.mcp_idempotency_keys set result = final_result where id = claimed_id;
  return final_result;
end;
$$;

revoke all on function public.mcp_create_sales_artifact(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_create_sales_artifact(uuid, uuid, uuid, text, text, jsonb) to service_role;
