create or replace function public.resolve_crm_sync_conflict(
  p_workspace_id uuid,
  p_issue_id uuid,
  p_resolution text,
  p_requested_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  issue public.crm_record_links%rowtype;
  run_id uuid;
  resolved_at timestamptz := now();
begin
  if p_resolution not in ('keep_local', 'use_external') then
    raise exception 'Invalid conflict resolution.';
  end if;

  select * into issue
  from public.crm_record_links
  where id = p_issue_id and workspace_id = p_workspace_id
  for update;

  if not found then raise exception 'CRM synchronization issue not found.'; end if;
  if issue.sync_status <> 'conflict' then
    return jsonb_build_object('id', issue.id, 'status', issue.sync_status, 'replayed', true);
  end if;

  if p_resolution = 'keep_local' then
    update public.crm_record_links
    set sync_status = 'synced', conflict_resolution = 'keep_local',
        leadely_updated_at = resolved_at, last_synced_at = resolved_at,
        external_snapshot = null, last_error = null
    where id = issue.id;
    return jsonb_build_object('id', issue.id, 'status', 'synced', 'resolution', p_resolution);
  end if;

  insert into public.crm_sync_runs (
    workspace_id, connection_id, direction, status, sync_objects, requested_by
  ) values (
    p_workspace_id, issue.connection_id, 'import', 'queued', array[issue.object_type], p_requested_by
  ) returning id into run_id;

  update public.crm_record_links
  set sync_status = 'pending', conflict_resolution = 'use_external', last_error = null
  where id = issue.id;

  return jsonb_build_object('id', issue.id, 'status', 'pending', 'resolution', p_resolution, 'runId', run_id);
end;
$$;

revoke all on function public.resolve_crm_sync_conflict(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_crm_sync_conflict(uuid, uuid, text, uuid) to service_role;

