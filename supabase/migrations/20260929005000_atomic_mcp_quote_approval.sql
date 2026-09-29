-- Atomic, role-checked quote approval for MCP action requests.
create or replace function public.review_mcp_quote_action(
  p_request_id uuid,
  p_workspace_id uuid,
  p_reviewer_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_request public.mcp_action_requests%rowtype;
  quote_result jsonb;
  current_time timestamptz := now();
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid review decision';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_reviewer_id
      and wm.role in ('owner', 'admin')
  ) then
    raise exception 'Reviewer is not authorized for this workspace';
  end if;

  select request_row.* into action_request
  from public.mcp_action_requests request_row
  where request_row.id = p_request_id
    and request_row.workspace_id = p_workspace_id
    and request_row.action_type = 'mark_quote_sent'
  for update;

  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if action_request.status <> 'pending' then
    return jsonb_build_object('id', action_request.id, 'status', action_request.status, 'alreadyReviewed', true);
  end if;
  if action_request.expires_at <= current_time then
    update public.mcp_action_requests
    set status = 'expired', reviewed_by = p_reviewer_id, reviewed_at = current_time, completed_at = current_time
    where id = action_request.id;
    return jsonb_build_object('id', action_request.id, 'status', 'expired');
  end if;
  if p_decision = 'reject' then
    update public.mcp_action_requests
    set status = 'rejected', reviewed_by = p_reviewer_id, reviewed_at = current_time, completed_at = current_time
    where id = action_request.id;
    return jsonb_build_object('id', action_request.id, 'status', 'rejected');
  end if;

  update public.mcp_action_requests
  set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = current_time
  where id = action_request.id;

  update public.quotes quote_row
  set status = 'sent', quote_status_v2 = 'sent', sent_at = current_time
  where quote_row.id = (action_request.payload ->> 'quoteId')::uuid
    and quote_row.workspace_id = p_workspace_id
    and quote_row.quote_status_v2 = 'draft'
  returning jsonb_build_object('id', quote_row.id, 'title', quote_row.title, 'status', quote_row.status, 'quote_status_v2', quote_row.quote_status_v2, 'sent_at', quote_row.sent_at)
  into quote_result;

  if quote_result is null then
    update public.mcp_action_requests
    set status = 'failed', error_message = 'Quote is no longer a draft or was not found.', completed_at = current_time
    where id = action_request.id;
    return jsonb_build_object('id', action_request.id, 'status', 'failed');
  end if;

  update public.mcp_action_requests
  set status = 'completed', result = quote_result, completed_at = current_time
  where id = action_request.id;
  return jsonb_build_object('id', action_request.id, 'status', 'completed', 'result', quote_result);
end;
$$;

revoke all on function public.review_mcp_quote_action(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_mcp_quote_action(uuid, uuid, uuid, text) to service_role;
