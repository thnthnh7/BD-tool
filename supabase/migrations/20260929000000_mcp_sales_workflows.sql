-- Idempotent MCP list and task workflows.
create or replace function public.mcp_manage_sales_workflow(
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
  target_status text;
begin
  if p_tool_name not in ('create_list', 'remove_company_from_list', 'update_task') then raise exception 'Unsupported MCP sales workflow'; end if;
  if char_length(p_idempotency_key) not between 8 and 120 then raise exception 'Invalid idempotency key'; end if;
  if not exists (select 1 from public.mcp_connections where id = p_connection_id and workspace_id = p_workspace_id and status = 'active' and scopes @> array['crm:write']::text[]) then raise exception 'MCP connection is not authorized for crm:write'; end if;

  insert into public.mcp_idempotency_keys (workspace_id, connection_id, tool_name, idempotency_key, result)
  values (p_workspace_id, p_connection_id, p_tool_name, p_idempotency_key, jsonb_build_object('status', 'processing'))
  on conflict (connection_id, tool_name, idempotency_key) do nothing returning id into claimed_id;
  if claimed_id is null then
    select result into existing_result from public.mcp_idempotency_keys where connection_id = p_connection_id and tool_name = p_tool_name and idempotency_key = p_idempotency_key;
    if existing_result ->> 'status' = 'processing' then raise exception 'This MCP request is still processing'; end if;
    return existing_result || jsonb_build_object('replayed', true);
  end if;

  if p_tool_name = 'create_list' then
    if nullif(trim(p_payload ->> 'name'), '') is null then raise exception 'List name is required'; end if;
    insert into public.lead_lists (workspace_id, name, description, source, owner_user_id)
    values (p_workspace_id, left(trim(p_payload ->> 'name'), 160), nullif(left(trim(coalesce(p_payload ->> 'description', '')), 1000), ''), 'mcp', p_actor_user_id)
    returning id into target_id;
  elsif p_tool_name = 'remove_company_from_list' then
    if not exists (select 1 from public.lead_lists where id = (p_payload ->> 'listId')::uuid and workspace_id = p_workspace_id) then raise exception 'List not found in this workspace'; end if;
    if not exists (select 1 from public.companies where id = (p_payload ->> 'companyId')::uuid and workspace_id = p_workspace_id) then raise exception 'Company not found in this workspace'; end if;
    delete from public.lead_list_members where workspace_id = p_workspace_id and list_id = (p_payload ->> 'listId')::uuid and company_id = (p_payload ->> 'companyId')::uuid returning id into target_id;
  else
    target_status := nullif(p_payload ->> 'status', '');
    if target_status is not null and target_status not in ('open', 'completed', 'canceled') then raise exception 'Invalid task status'; end if;
    update public.tasks set
      title = case when p_payload ? 'title' then left(p_payload ->> 'title', 200) else title end,
      description = case when p_payload ? 'description' then left(p_payload ->> 'description', 2000) else description end,
      priority = case when p_payload ? 'priority' then p_payload ->> 'priority' else priority end,
      status = coalesce(target_status, status),
      due_at = case when p_payload ? 'dueAt' then nullif(p_payload ->> 'dueAt', '')::timestamptz else due_at end,
      completed_at = case when target_status = 'completed' then coalesce(completed_at, now()) when target_status in ('open', 'canceled') then null else completed_at end
    where id = (p_payload ->> 'taskId')::uuid and workspace_id = p_workspace_id
    returning id into target_id;
    if target_id is null then raise exception 'Task not found in this workspace'; end if;
  end if;

  final_result := jsonb_build_object('id', target_id, 'type', p_tool_name, 'updatedAt', now());
  update public.mcp_idempotency_keys set result = final_result where id = claimed_id;
  return final_result;
end;
$$;

revoke all on function public.mcp_manage_sales_workflow(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_manage_sales_workflow(uuid, uuid, uuid, text, text, jsonb) to service_role;
