-- Workspace data library for heterogeneous Actor outputs.
-- Keeps immutable source payloads while allowing normalized, searchable records.

create table public.data_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scrape_job_id uuid references public.lead_scrape_jobs (id) on delete set null,
  name text not null,
  description text not null default '',
  source_type text not null default 'apify_dataset'
    check (source_type in ('apify_dataset', 'upload', 'manual', 'api')),
  source_actor_id text not null default '',
  external_dataset_id text,
  schema_version integer not null default 1,
  record_count integer not null default 0,
  status text not null default 'active'
    check (status in ('processing', 'active', 'archived', 'error')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scrape_job_id)
);

create index data_collections_workspace_idx
  on public.data_collections (workspace_id, updated_at desc);

create trigger data_collections_updated_at
before update on public.data_collections
for each row execute function public.set_updated_at();

create table public.data_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  collection_id uuid not null references public.data_collections (id) on delete cascade,
  scrape_result_id uuid references public.lead_scrape_results (id) on delete set null,
  source_item_key text not null,
  record_type text not null default 'generic_record'
    check (record_type in (
      'person_profile', 'organization', 'place', 'social_content', 'job_listing',
      'product_listing', 'review', 'web_page', 'search_result', 'media_asset',
      'document', 'generic_record'
    )),
  title text not null default '',
  canonical_url text not null default '',
  normalized_data jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  identity_keys jsonb not null default '{}'::jsonb,
  content_hash text not null default '',
  promoted_company_id uuid references public.companies (id) on delete set null,
  promoted_contact_id uuid references public.contacts (id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, source_item_key)
);

create index data_records_workspace_type_idx
  on public.data_records (workspace_id, record_type, captured_at desc);
create index data_records_collection_idx
  on public.data_records (collection_id, captured_at desc);
create index data_records_search_idx
  on public.data_records using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(normalized_data::text, ''))
  );

create trigger data_records_updated_at
before update on public.data_records
for each row execute function public.set_updated_at();

create table public.data_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  collection_id uuid not null references public.data_collections (id) on delete cascade,
  record_id uuid references public.data_records (id) on delete cascade,
  asset_type text not null default 'file'
    check (asset_type in ('image', 'video', 'audio', 'document', 'subtitle', 'file')),
  file_name text not null default '',
  mime_type text not null default '',
  source_url text not null default '',
  storage_path text not null default '',
  byte_size bigint not null default 0,
  checksum text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index data_assets_workspace_idx on public.data_assets (workspace_id, created_at desc);
create index data_assets_record_idx on public.data_assets (record_id);

create table public.data_record_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_record_id uuid not null references public.data_records (id) on delete cascade,
  to_record_id uuid not null references public.data_records (id) on delete cascade,
  relation_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (from_record_id, to_record_id, relation_type),
  check (from_record_id <> to_record_id)
);

create index data_record_links_workspace_idx on public.data_record_links (workspace_id);
create index data_record_links_from_idx on public.data_record_links (from_record_id);
create index data_record_links_to_idx on public.data_record_links (to_record_id);

alter table public.data_collections enable row level security;
alter table public.data_records enable row level security;
alter table public.data_assets enable row level security;
alter table public.data_record_links enable row level security;

create policy data_collections_member_all on public.data_collections
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy data_records_member_all on public.data_records
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy data_assets_member_all on public.data_assets
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy data_record_links_member_all on public.data_record_links
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

