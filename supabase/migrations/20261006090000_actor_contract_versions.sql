alter table public.scrape_sources
  add column if not exists actor_build_id text,
  add column if not exists actor_build_number text,
  add column if not exists actor_build_tag text,
  add column if not exists contract_hash text,
  add column if not exists readme_markdown text,
  add column if not exists contract_last_checked_at timestamptz,
  add column if not exists contract_fetch_status text not null default 'pending'
    check (contract_fetch_status in ('pending', 'ready', 'stale', 'error')),
  add column if not exists contract_fetch_error text,
  add column if not exists actor_store_url text;

create table if not exists public.scrape_source_contract_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.scrape_sources (id) on delete cascade,
  actor_slug text not null,
  build_id text not null,
  build_number text,
  build_tag text not null default 'default',
  contract_hash text not null,
  input_schema jsonb not null,
  example_input jsonb,
  readme_markdown text,
  root_description text,
  output_schema jsonb,
  pricing_snapshot jsonb,
  actor_store_url text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (source_id, contract_hash)
);

create index if not exists scrape_source_contract_versions_source_idx
  on public.scrape_source_contract_versions (source_id, fetched_at desc);

alter table public.scrape_source_contract_versions enable row level security;

create policy scrape_source_contract_versions_member_select
  on public.scrape_source_contract_versions
  for select using (public.current_workspace_id() is not null);

grant select on public.scrape_source_contract_versions to authenticated;
grant all on public.scrape_source_contract_versions to service_role;

comment on table public.scrape_source_contract_versions is
  'Immutable Apify Actor contract snapshots used to audit schema, README and build changes.';
comment on column public.scrape_sources.readme_markdown is
  'Untrusted Actor README Markdown. Sanitize before display and before use as AI grounding.';
