create table if not exists public.crm_sync_record_failures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.crm_connections (id) on delete cascade,
  run_id uuid references public.crm_sync_runs (id) on delete set null,
  object_type text not null,
  external_record_id text not null,
  error_message text not null,
  record_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'retrying', 'resolved')),
  attempt_count integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, object_type, external_record_id)
);

create trigger crm_sync_record_failures_updated_at before update on public.crm_sync_record_failures
for each row execute function public.set_updated_at();
create index crm_sync_record_failures_open_idx on public.crm_sync_record_failures (workspace_id, status, updated_at desc);
alter table public.crm_sync_record_failures enable row level security;
create policy crm_sync_record_failures_member_read on public.crm_sync_record_failures
  for select using (workspace_id = public.current_workspace_id());

create or replace function public.retry_crm_sync_record_failure(
  p_workspace_id uuid, p_failure_id uuid, p_requested_by uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare failure public.crm_sync_record_failures%rowtype; new_run_id uuid;
begin
  select * into failure from public.crm_sync_record_failures
  where id = p_failure_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'CRM record failure not found.'; end if;
  if failure.status = 'retrying' then
    return jsonb_build_object('id', failure.id, 'status', failure.status, 'replayed', true);
  end if;
  insert into public.crm_sync_runs (workspace_id, connection_id, direction, status, sync_objects, cursor_state, requested_by)
  values (p_workspace_id, failure.connection_id, 'import', 'queued', array[failure.object_type],
    jsonb_build_object('objectIndex', 0, 'recordId', failure.external_record_id, 'failureId', failure.id), p_requested_by)
  returning id into new_run_id;
  update public.crm_sync_record_failures set status = 'retrying', resolved_at = null where id = failure.id;
  return jsonb_build_object('id', failure.id, 'status', 'retrying', 'runId', new_run_id);
end; $$;

revoke all on function public.retry_crm_sync_record_failure(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.retry_crm_sync_record_failure(uuid, uuid, uuid) to service_role;

