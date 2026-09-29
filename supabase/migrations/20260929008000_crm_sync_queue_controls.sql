-- Internal CRM queue controls: cancellation, stale-run recovery and dead letters.

alter table public.crm_sync_runs drop constraint if exists crm_sync_runs_status_check;
alter table public.crm_sync_runs
  add constraint crm_sync_runs_status_check
  check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'canceled', 'dead_letter'));

alter table public.crm_sync_runs
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists crm_sync_runs_updated_at on public.crm_sync_runs;
create trigger crm_sync_runs_updated_at
before update on public.crm_sync_runs
for each row execute function public.set_updated_at();

create or replace function public.claim_next_crm_sync_run()
returns setof public.crm_sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare claimed_id uuid;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'Service role required'; end if;

  update public.crm_sync_runs
  set status = case when attempt_count >= 4 then 'dead_letter' else 'queued' end,
      next_attempt_at = now(),
      error_summary = coalesce(error_summary, 'Worker heartbeat expired.'),
      completed_at = case when attempt_count >= 4 then now() else null end
  where status = 'running' and updated_at < now() - interval '10 minutes';

  update public.crm_sync_runs
  set status = 'canceled', completed_at = now()
  where status = 'queued' and cancel_requested;

  select run.id into claimed_id
  from public.crm_sync_runs run
  join public.crm_connections connection on connection.id = run.connection_id
  where run.status = 'queued' and not run.cancel_requested
    and run.next_attempt_at <= now()
    and connection.provider = 'hubspot' and connection.status = 'connected'
  order by run.next_attempt_at, run.started_at
  for update of run skip locked
  limit 1;
  if claimed_id is null then return; end if;
  return query update public.crm_sync_runs
    set status = 'running', attempt_count = attempt_count + 1
    where id = claimed_id returning *;
end;
$$;

revoke all on function public.claim_next_crm_sync_run() from public, anon, authenticated;
grant execute on function public.claim_next_crm_sync_run() to service_role;
