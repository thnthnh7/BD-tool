-- Idempotent deal creation and constrained CRM updates for MCP.

create or replace function public.mcp_mutate_crm_record(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_actor_user_id uuid,
  p_tool_name text,
  p_idempotency_key text,
  p_record_id uuid,
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
  selected_pipeline uuid;
  selected_stage uuid;
  linked_company uuid;
begin
  if p_tool_name not in ('create_deal', 'update_company', 'update_contact', 'update_lead', 'update_deal') then
    raise exception 'Unsupported MCP CRM mutation';
  end if;
  if char_length(p_idempotency_key) not between 8 and 120 then raise exception 'Invalid idempotency key'; end if;
  if not exists (
    select 1 from public.mcp_connections
    where id = p_connection_id and workspace_id = p_workspace_id
      and status = 'active' and scopes @> array['crm:write']::text[]
  ) then raise exception 'MCP connection is not authorized'; end if;

  insert into public.mcp_idempotency_keys (workspace_id, connection_id, tool_name, idempotency_key, result)
  values (p_workspace_id, p_connection_id, p_tool_name, p_idempotency_key, jsonb_build_object('status', 'processing'))
  on conflict (connection_id, tool_name, idempotency_key) do nothing returning id into claimed_id;
  if claimed_id is null then
    select result into existing_result from public.mcp_idempotency_keys
    where connection_id = p_connection_id and tool_name = p_tool_name and idempotency_key = p_idempotency_key;
    if existing_result ->> 'status' = 'processing' then raise exception 'This MCP request is still processing'; end if;
    return existing_result || jsonb_build_object('replayed', true);
  end if;

  if p_tool_name = 'create_deal' then
    linked_company := nullif(p_payload ->> 'companyId', '')::uuid;
    if linked_company is null or not exists (select 1 from public.companies where id = linked_company and workspace_id = p_workspace_id) then raise exception 'Company not found in this workspace'; end if;
    if nullif(p_payload ->> 'contactId', '') is not null and not exists (select 1 from public.contacts where id = (p_payload ->> 'contactId')::uuid and workspace_id = p_workspace_id) then raise exception 'Contact not found in this workspace'; end if;
    selected_pipeline := nullif(p_payload ->> 'pipelineId', '')::uuid;
    if selected_pipeline is null then select id into selected_pipeline from public.pipelines where workspace_id = p_workspace_id order by is_default desc, created_at limit 1; end if;
    if selected_pipeline is null or not exists (select 1 from public.pipelines where id = selected_pipeline and workspace_id = p_workspace_id) then raise exception 'Sales pipeline not found in this workspace'; end if;
    selected_stage := nullif(p_payload ->> 'stageId', '')::uuid;
    if selected_stage is null then select id into selected_stage from public.pipeline_stages where workspace_id = p_workspace_id and pipeline_id = selected_pipeline and stage_type = 'open' order by position limit 1; end if;
    if selected_stage is null or not exists (select 1 from public.pipeline_stages where id = selected_stage and workspace_id = p_workspace_id and pipeline_id = selected_pipeline) then raise exception 'Pipeline stage not found in this workspace'; end if;
    insert into public.deals (workspace_id, company_id, primary_contact_id, pipeline_id, stage_id, owner_user_id, title, description, deal_type, amount, currency, probability, expected_close_date, priority, source)
    values (p_workspace_id, linked_company, nullif(p_payload ->> 'contactId', '')::uuid, selected_pipeline, selected_stage, p_actor_user_id, p_payload ->> 'title', coalesce(p_payload ->> 'description', ''), coalesce(p_payload ->> 'dealType', 'sales'), coalesce(nullif(p_payload ->> 'amount', '')::integer, 0), coalesce(p_payload ->> 'currency', 'USD'), coalesce(nullif(p_payload ->> 'probability', '')::integer, 0), nullif(p_payload ->> 'expectedCloseDate', '')::date, coalesce(p_payload ->> 'priority', 'medium'), coalesce(p_payload ->> 'source', 'MCP'))
    returning id into target_id;
  elsif p_tool_name = 'update_company' then
    update public.companies set
      name = coalesce(nullif(p_payload ->> 'name', ''), name), website = coalesce(p_payload ->> 'website', website), industry = coalesce(p_payload ->> 'industry', industry), company_size = coalesce(p_payload ->> 'companySize', company_size), phone = coalesce(p_payload ->> 'phone', phone), email = coalesce(p_payload ->> 'email', email), notes = coalesce(p_payload ->> 'notes', notes), lifecycle_stage = coalesce(p_payload ->> 'lifecycleStage', lifecycle_stage)
    where id = p_record_id and workspace_id = p_workspace_id returning id into target_id;
  elsif p_tool_name = 'update_contact' then
    update public.contacts set
      display_name = coalesce(nullif(p_payload ->> 'displayName', ''), display_name), first_name = coalesce(p_payload ->> 'firstName', first_name), last_name = coalesce(p_payload ->> 'lastName', last_name), email = coalesce(p_payload ->> 'email', email), phone = coalesce(p_payload ->> 'phone', phone), job_title = coalesce(p_payload ->> 'jobTitle', job_title), linkedin_url = coalesce(p_payload ->> 'linkedinUrl', linkedin_url), notes = coalesce(p_payload ->> 'notes', notes)
    where id = p_record_id and workspace_id = p_workspace_id returning id into target_id;
  elsif p_tool_name = 'update_lead' then
    update public.leads set status = coalesce(p_payload ->> 'status', status), score = coalesce(nullif(p_payload ->> 'score', '')::integer, score), score_reason = coalesce(p_payload ->> 'scoreReason', score_reason), next_action_at = coalesce(nullif(p_payload ->> 'nextActionAt', '')::timestamptz, next_action_at)
    where id = p_record_id and workspace_id = p_workspace_id returning id into target_id;
  else
    update public.deals set title = coalesce(nullif(p_payload ->> 'title', ''), title), description = coalesce(p_payload ->> 'description', description), amount = coalesce(nullif(p_payload ->> 'amount', '')::integer, amount), currency = coalesce(p_payload ->> 'currency', currency), probability = coalesce(nullif(p_payload ->> 'probability', '')::integer, probability), expected_close_date = coalesce(nullif(p_payload ->> 'expectedCloseDate', '')::date, expected_close_date), priority = coalesce(p_payload ->> 'priority', priority)
    where id = p_record_id and workspace_id = p_workspace_id returning id into target_id;
  end if;
  if target_id is null then raise exception 'CRM record not found in this workspace'; end if;
  final_result := jsonb_build_object('id', target_id, 'type', p_tool_name, 'updatedAt', now());
  update public.mcp_idempotency_keys set result = final_result where id = claimed_id;
  return final_result;
end;
$$;

revoke all on function public.mcp_mutate_crm_record(uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_mutate_crm_record(uuid, uuid, uuid, text, text, uuid, jsonb) to service_role;
