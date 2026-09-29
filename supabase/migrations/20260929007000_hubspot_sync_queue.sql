-- Durable HubSpot synchronization queue used by approved MCP actions.

alter table public.crm_sync_runs drop constraint if exists crm_sync_runs_status_check;
alter table public.crm_sync_runs
  add constraint crm_sync_runs_status_check
  check (status in ('queued', 'running', 'completed', 'partial', 'failed'));

alter table public.crm_sync_runs
  add column if not exists sync_objects text[] not null default '{}'::text[],
  add column if not exists cursor_state jsonb not null default '{}'::jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists requested_by uuid references public.profiles (id) on delete set null;

create index if not exists crm_sync_runs_queue_idx
  on public.crm_sync_runs (next_attempt_at, started_at)
  where status = 'queued';

create or replace function public.claim_next_crm_sync_run()
returns setof public.crm_sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'Service role required'; end if;
  select run.id into claimed_id
  from public.crm_sync_runs run
  join public.crm_connections connection on connection.id = run.connection_id
  where run.status = 'queued'
    and run.next_attempt_at <= now()
    and connection.provider = 'hubspot'
    and connection.status = 'connected'
  order by run.next_attempt_at, run.started_at
  for update of run skip locked
  limit 1;
  if claimed_id is null then return; end if;
  return query
    update public.crm_sync_runs
    set status = 'running', attempt_count = attempt_count + 1
    where id = claimed_id
    returning *;
end;
$$;

revoke all on function public.claim_next_crm_sync_run() from public, anon, authenticated;
grant execute on function public.claim_next_crm_sync_run() to service_role;

alter table public.mcp_action_requests drop constraint if exists mcp_action_requests_action_type_check;
alter table public.mcp_action_requests
  add constraint mcp_action_requests_action_type_check
  check (action_type in ('create_company', 'start_maps_scrape', 'mark_quote_sent', 'start_crm_sync'));

create or replace function public.notify_mcp_action_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select new.workspace_id, member.user_id, 'MCP approval required',
      case new.action_type
        when 'start_maps_scrape' then 'An AI client requested a paid scrape run.'
        when 'mark_quote_sent' then 'An AI client requested that a draft quote be marked as sent.'
        when 'start_crm_sync' then 'An AI client requested a HubSpot data synchronization.'
        else 'An AI client requested an action that needs approval.'
      end,
      'warning', 'mcp_action_request', new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id and member.role in ('owner', 'admin');
  end if;
  return new;
end;
$$;
