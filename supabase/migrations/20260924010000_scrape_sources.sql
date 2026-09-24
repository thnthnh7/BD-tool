-- Apify lead-generation catalog. Sync fills rows; only ready actors can be installed.

create extension if not exists pg_trgm;

create table public.scrape_sources (
  id uuid primary key default gen_random_uuid(),
  apify_id text not null unique,
  slug text not null unique,
  title text not null,
  description text not null default '',
  picture_url text,
  store_url text,
  categories text[] not null default '{}',
  pricing_model text,
  notice text,
  review_rating numeric,
  review_count integer not null default 0,
  total_users integer not null default 0,
  adapter_status text not null default 'preview'
    check (adapter_status in ('preview', 'ready')),
  synced_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scrape_sources_title_trgm_idx on public.scrape_sources using gin (title gin_trgm_ops);
create index scrape_sources_description_trgm_idx on public.scrape_sources using gin (description gin_trgm_ops);
create index scrape_sources_slug_trgm_idx on public.scrape_sources using gin (slug gin_trgm_ops);
create index scrape_sources_categories_idx on public.scrape_sources using gin (categories);
create index scrape_sources_active_users_idx on public.scrape_sources (total_users desc) where archived_at is null;

create trigger scrape_sources_updated_at
before update on public.scrape_sources
for each row execute function public.set_updated_at();

create table public.workspace_scrape_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_id uuid not null references public.scrape_sources (id) on delete cascade,
  installed_by uuid references public.profiles (id) on delete set null,
  installed_at timestamptz not null default now(),
  unique (workspace_id, source_id)
);

create index workspace_scrape_sources_workspace_idx on public.workspace_scrape_sources (workspace_id);

alter table public.lead_scrape_jobs
  add column source_id uuid references public.scrape_sources (id) on delete set null;

create index lead_scrape_jobs_source_id_idx on public.lead_scrape_jobs (source_id);

-- Google Maps is the only ready adapter. apify_id matches the public Store record.
insert into public.scrape_sources (
  apify_id,
  slug,
  title,
  description,
  store_url,
  categories,
  pricing_model,
  adapter_status,
  synced_at
) values (
  'nwua9Gu5YrADL7ZDj',
  'compass/crawler-google-places',
  'Google Maps Scraper',
  'Extract data from Google Maps locations and businesses, including contact info.',
  'https://apify.com/compass/crawler-google-places',
  array['LEAD_GENERATION', 'TRAVEL'],
  'PAY_PER_EVENT',
  'ready',
  now()
);

insert into public.workspace_scrape_sources (workspace_id, source_id)
select workspaces.id, sources.id
from public.workspaces
cross join public.scrape_sources sources
where sources.slug = 'compass/crawler-google-places'
on conflict (workspace_id, source_id) do nothing;

create or replace function public.install_default_scrape_sources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_scrape_sources (workspace_id, source_id)
  select new.id, sources.id
  from public.scrape_sources sources
  where sources.slug = 'compass/crawler-google-places'
  on conflict (workspace_id, source_id) do nothing;
  return new;
end;
$$;

create trigger workspaces_install_default_scrape_sources
after insert on public.workspaces
for each row execute function public.install_default_scrape_sources();

alter table public.scrape_sources enable row level security;
alter table public.workspace_scrape_sources enable row level security;

create policy scrape_sources_member_select on public.scrape_sources
  for select using (public.current_workspace_id() is not null);

create policy workspace_scrape_sources_member_select on public.workspace_scrape_sources
  for select using (workspace_id = public.current_workspace_id());

create policy workspace_scrape_sources_admin_insert on public.workspace_scrape_sources
  for insert with check (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  );

create policy workspace_scrape_sources_admin_delete on public.workspace_scrape_sources
  for delete using (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  );

grant select on public.scrape_sources to authenticated;
grant select, insert, delete on public.workspace_scrape_sources to authenticated;
grant all on public.scrape_sources to service_role;
grant all on public.workspace_scrape_sources to service_role;
