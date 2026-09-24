create table public.apify_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  apify_user_id text not null,
  apify_username text not null default '',
  apify_email text not null default '',
  apify_avatar_url text,
  apify_plan_id text,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  current_memory_gbytes numeric,
  max_memory_gbytes numeric,
  monthly_usage_usd numeric,
  max_monthly_usage_usd numeric,
  usage_cycle_start timestamptz,
  usage_cycle_end timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, apify_user_id)
);

create trigger apify_connections_updated_at before update on public.apify_connections
for each row execute function public.set_updated_at();

create table public.workspace_apify_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade unique,
  apify_connection_id uuid not null references public.apify_connections (id) on delete cascade,
  connected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_apify_connections_connection_idx on public.workspace_apify_connections (apify_connection_id);
create trigger workspace_apify_connections_updated_at before update on public.workspace_apify_connections
for each row execute function public.set_updated_at();

alter table public.lead_scrape_jobs
  add column apify_connection_id uuid references public.apify_connections (id) on delete set null,
  add column apify_account_id text,
  add column apify_account_username text;

create index lead_scrape_jobs_apify_connection_idx on public.lead_scrape_jobs (apify_connection_id);

alter table public.apify_connections enable row level security;
alter table public.workspace_apify_connections enable row level security;

create policy apify_connections_select on public.apify_connections for select using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.workspace_apify_connections link
    where link.apify_connection_id = id and link.workspace_id = public.current_workspace_id()
  )
);

create policy workspace_apify_connections_select on public.workspace_apify_connections for select using (
  workspace_id = public.current_workspace_id()
);

create policy workspace_apify_connections_admin_delete on public.workspace_apify_connections for delete using (
  workspace_id = public.current_workspace_id() and public.current_member_role() in ('owner', 'admin')
);

grant select on public.apify_connections to authenticated;
grant select, delete on public.workspace_apify_connections to authenticated;
grant all on public.apify_connections to service_role;
grant all on public.workspace_apify_connections to service_role;
