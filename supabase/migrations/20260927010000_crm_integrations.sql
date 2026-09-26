create table if not exists public.crm_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in (
    'hubspot', 'salesforce', 'dynamics_365', 'zoho', 'pipedrive',
    'freshsales', 'monday', 'close', 'bitrix24', 'activecampaign'
  )),
  status text not null default 'needs_authorization'
    check (status in ('needs_authorization', 'connected', 'paused', 'error')),
  sync_direction text not null default 'bidirectional'
    check (sync_direction in ('import', 'export', 'bidirectional')),
  conflict_policy text not null default 'latest_update'
    check (conflict_policy in ('latest_update', 'leadely_wins', 'crm_wins')),
  sync_objects text[] not null default array['contacts', 'companies', 'deals']::text[],
  account_label text not null default '',
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create trigger crm_connections_updated_at
before update on public.crm_connections
for each row execute function public.set_updated_at();

create table if not exists public.crm_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.crm_connections (id) on delete cascade,
  direction text not null check (direction in ('import', 'export')),
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  records_read integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists crm_connections_workspace_status_idx
  on public.crm_connections (workspace_id, status, updated_at desc);
create index if not exists crm_sync_runs_workspace_started_idx
  on public.crm_sync_runs (workspace_id, started_at desc);
create index if not exists crm_sync_runs_connection_started_idx
  on public.crm_sync_runs (connection_id, started_at desc);

alter table public.crm_connections enable row level security;
alter table public.crm_sync_runs enable row level security;

create policy crm_connections_member_all on public.crm_connections
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy crm_sync_runs_member_all on public.crm_sync_runs
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
