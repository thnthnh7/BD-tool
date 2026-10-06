create table if not exists public.actor_generated_guides (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.scrape_sources (id) on delete cascade,
  contract_hash text not null,
  locale text not null,
  prompt_version text not null,
  provider text not null,
  model text not null,
  guide jsonb not null,
  generated_at timestamptz not null default now(),
  unique (source_id, contract_hash, locale, prompt_version, provider, model)
);

alter table public.actor_generated_guides enable row level security;
create policy actor_generated_guides_member_select on public.actor_generated_guides
  for select using (exists (
    select 1 from public.workspace_scrape_sources installed
    where installed.workspace_id = public.current_workspace_id()
      and installed.source_id = actor_generated_guides.source_id
  ));
grant select on public.actor_generated_guides to authenticated;
grant all on public.actor_generated_guides to service_role;

drop policy if exists scrape_source_contract_versions_member_select on public.scrape_source_contract_versions;
create policy scrape_source_contract_versions_installed_select
  on public.scrape_source_contract_versions for select using (exists (
    select 1 from public.workspace_scrape_sources installed
    where installed.workspace_id = public.current_workspace_id()
      and installed.source_id = scrape_source_contract_versions.source_id
  ));

create table if not exists public.actor_guidance_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  source_id uuid references public.scrape_sources (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists actor_guidance_events_workspace_idx
  on public.actor_guidance_events (workspace_id, created_at desc);

alter table public.actor_guidance_events enable row level security;
create policy actor_guidance_events_member_insert on public.actor_guidance_events
  for insert with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());
grant insert on public.actor_guidance_events to authenticated;
grant all on public.actor_guidance_events to service_role;

alter table public.lead_scrape_jobs
  add column if not exists actor_contract_hash text,
  add column if not exists actor_build_id text,
  add column if not exists actor_input_hash text,
  add column if not exists pricing_basis jsonb,
  add column if not exists actor_validation_result jsonb,
  add column if not exists guide_source_versions jsonb;

comment on table public.actor_generated_guides is
  'Localized structured Actor guides keyed by immutable contract and generator identity.';
comment on table public.actor_guidance_events is
  'Secret-free product telemetry for Actor guidance and validation.';
