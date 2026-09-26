alter table public.crm_connections
  add column if not exists setup_step text not null default 'authorization'
    check (setup_step in ('authorization', 'mapping', 'initial_sync', 'active')),
  add column if not exists sync_interval_minutes integer not null default 15
    check (sync_interval_minutes in (5, 15, 30, 60, 360, 1440)),
  add column if not exists webhook_status text not null default 'not_configured'
    check (webhook_status in ('not_configured', 'active', 'error')),
  add column if not exists last_full_sync_at timestamptz,
  add column if not exists next_sync_at timestamptz;

create table if not exists public.crm_field_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.crm_connections (id) on delete cascade,
  object_type text not null check (object_type in ('contacts', 'companies', 'deals', 'activities', 'tasks', 'notes')),
  leadely_field text not null,
  external_field text not null,
  sync_direction text not null default 'bidirectional'
    check (sync_direction in ('import', 'export', 'bidirectional')),
  transformation text not null default 'none',
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, object_type, leadely_field)
);

create trigger crm_field_mappings_updated_at
before update on public.crm_field_mappings
for each row execute function public.set_updated_at();

create table if not exists public.crm_record_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.crm_connections (id) on delete cascade,
  object_type text not null,
  leadely_record_id uuid not null,
  external_record_id text not null,
  leadely_updated_at timestamptz,
  external_updated_at timestamptz,
  last_synced_at timestamptz,
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'conflict', 'error')),
  content_hash text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, object_type, leadely_record_id),
  unique (connection_id, object_type, external_record_id)
);

create trigger crm_record_links_updated_at
before update on public.crm_record_links
for each row execute function public.set_updated_at();

create index if not exists crm_field_mappings_connection_idx on public.crm_field_mappings (connection_id, object_type);
create index if not exists crm_record_links_connection_status_idx on public.crm_record_links (connection_id, sync_status, updated_at desc);

alter table public.crm_field_mappings enable row level security;
alter table public.crm_record_links enable row level security;

create policy crm_field_mappings_member_all on public.crm_field_mappings
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy crm_record_links_member_all on public.crm_record_links
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
