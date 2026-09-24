-- Phase 1B Find + 1C BYOK + Phase 2+ quote/intel/comms/outbound (additive).

-- ---------------------------------------------------------------------------
-- Usage counters + plan entitlements
-- ---------------------------------------------------------------------------

alter table public.usage_counters
  add column if not exists maps_scrapes integer not null default 0,
  add column if not exists maps_places integer not null default 0,
  add column if not exists maps_people integer not null default 0;

update public.plans
set
  features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
    'byok_ai', not is_free,
    'lead_scrape', not is_free
  ),
  quotas = coalesce(quotas, '{}'::jsonb) || jsonb_build_object(
    'maps_scrapes_per_month', case when is_free then 0 else 10 end,
    'maps_places_per_month', case when is_free then 0 else 250 end,
    'maps_people_per_month', case when is_free then 0 else 500 end
  );

-- ---------------------------------------------------------------------------
-- Lead scrape
-- ---------------------------------------------------------------------------

create table public.lead_scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  query text not null,
  location text not null default '',
  language text not null default 'vi',
  max_results integer not null default 20,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  apify_actor_id text not null default 'compass/crawler-google-places',
  apify_run_id text,
  apify_dataset_id text,
  webhook_secret text not null default replace(gen_random_uuid()::text, '-', ''),
  places_found integer not null default 0,
  places_imported integer not null default 0,
  people_found integer not null default 0,
  people_imported integer not null default 0,
  enrich_people boolean not null default true,
  max_people_per_place integer not null default 5,
  verify_emails boolean not null default false,
  pdpa_confirmed boolean not null default false,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_scrape_jobs_workspace_id_idx on public.lead_scrape_jobs (workspace_id);
create index lead_scrape_jobs_run_id_idx on public.lead_scrape_jobs (apify_run_id);

create trigger lead_scrape_jobs_updated_at
before update on public.lead_scrape_jobs
for each row execute function public.set_updated_at();

create table public.lead_scrape_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.lead_scrape_jobs (id) on delete cascade,
  google_place_id text,
  name text not null default '',
  category text,
  address text,
  city text,
  phone text,
  website text,
  email text,
  rating numeric,
  reviews_count integer,
  lat numeric,
  lng numeric,
  maps_url text,
  image_url text,
  raw jsonb not null default '{}'::jsonb,
  match_status text not null default 'new'
    check (match_status in ('new', 'duplicate_company', 'duplicate_lead', 'skipped', 'imported')),
  matched_company_id uuid references public.companies (id) on delete set null,
  matched_lead_id uuid references public.leads (id) on delete set null,
  selected boolean not null default true,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create index lead_scrape_results_job_id_idx on public.lead_scrape_results (job_id);
create index lead_scrape_results_workspace_id_idx on public.lead_scrape_results (workspace_id);

create table public.lead_scrape_people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  result_id uuid not null references public.lead_scrape_results (id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  job_title text,
  linkedin_url text,
  department text,
  seniority text,
  email_verification text,
  raw jsonb not null default '{}'::jsonb,
  match_status text not null default 'new'
    check (match_status in ('new', 'duplicate_contact', 'skipped', 'imported')),
  matched_contact_id uuid references public.contacts (id) on delete set null,
  selected boolean not null default true,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create index lead_scrape_people_result_id_idx on public.lead_scrape_people (result_id);
create index lead_scrape_people_workspace_id_idx on public.lead_scrape_people (workspace_id);

-- ---------------------------------------------------------------------------
-- Lead lists
-- ---------------------------------------------------------------------------

create table public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  source text not null default 'manual'
    check (source in ('scrape', 'manual', 'mixed')),
  scrape_job_id uuid references public.lead_scrape_jobs (id) on delete set null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_lists_workspace_id_idx on public.lead_lists (workspace_id);

create trigger lead_lists_updated_at
before update on public.lead_lists
for each row execute function public.set_updated_at();

create table public.lead_list_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid not null references public.lead_lists (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  added_from text not null default 'crm'
    check (added_from in ('scrape', 'crm', 'import')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'proposed', 'won', 'skipped')),
  created_at timestamptz not null default now(),
  unique (list_id, company_id)
);

create index lead_list_members_list_id_idx on public.lead_list_members (list_id);
create index lead_list_members_workspace_id_idx on public.lead_list_members (workspace_id);

-- ---------------------------------------------------------------------------
-- BYOK
-- ---------------------------------------------------------------------------

create table public.workspace_ai_providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'openai'
    check (provider in ('openai', 'openrouter', 'groq', 'azure', 'nine_router', 'custom')),
  base_url text not null,
  model text not null,
  encrypted_api_key text not null,
  is_default boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'invalid')),
  created_by uuid references public.profiles (id) on delete set null,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspace_ai_providers_default_uidx
  on public.workspace_ai_providers (workspace_id)
  where is_default;
create index workspace_ai_providers_workspace_id_idx on public.workspace_ai_providers (workspace_id);

create trigger workspace_ai_providers_updated_at
before update on public.workspace_ai_providers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quote engagement, contracts, notifications
-- ---------------------------------------------------------------------------

create table public.quote_engagement_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  public_quote_id text,
  deal_id uuid references public.deals (id) on delete set null,
  viewer_session_id text,
  event_type text not null
    check (event_type in ('opened', 'section_viewed', 'pdf_downloaded', 'accepted', 'rejected')),
  section text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index quote_engagement_events_quote_id_idx on public.quote_engagement_events (quote_id);
create index quote_engagement_events_workspace_id_idx on public.quote_engagement_events (workspace_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'void')),
  signed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_workspace_id_idx on public.contracts (workspace_id);
create index contracts_deal_id_idx on public.contracts (deal_id);

create trigger contracts_updated_at
before update on public.contracts
for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'info',
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_workspace_user_idx on public.notifications (workspace_id, user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Comms / outbound foundation
-- ---------------------------------------------------------------------------

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null
    check (provider in ('gmail', 'outlook', 'google_calendar', 'microsoft_calendar')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  account_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create trigger integration_connections_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'manual'
    check (provider in ('manual', 'gmail', 'outlook')),
  direction text not null default 'outbound'
    check (direction in ('inbound', 'outbound')),
  subject text not null default '',
  body text not null default '',
  from_address text not null default '',
  to_address text not null default '',
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index communications_workspace_id_idx on public.communications (workspace_id);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '',
  notes text not null default '',
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_workspace_id_idx on public.meetings (workspace_id);

create trigger meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sequences_updated_at
before update on public.sequences
for each row execute function public.set_updated_at();

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  position integer not null default 0,
  step_type text not null default 'email'
    check (step_type in ('email', 'task', 'wait')),
  delay_days integer not null default 0,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create index sequence_steps_sequence_id_idx on public.sequence_steps (sequence_id);

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'stopped')),
  current_step integer not null default 0,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create index sequence_enrollments_sequence_id_idx on public.sequence_enrollments (sequence_id);

create table public.account_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  objective text not null default '',
  strategy text not null default '',
  risks text not null default '',
  next_review_at date,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id)
);

create trigger account_plans_updated_at
before update on public.account_plans
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.lead_scrape_jobs enable row level security;
alter table public.lead_scrape_results enable row level security;
alter table public.lead_scrape_people enable row level security;
alter table public.lead_lists enable row level security;
alter table public.lead_list_members enable row level security;
alter table public.workspace_ai_providers enable row level security;
alter table public.quote_engagement_events enable row level security;
alter table public.contracts enable row level security;
alter table public.notifications enable row level security;
alter table public.integration_connections enable row level security;
alter table public.communications enable row level security;
alter table public.meetings enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.account_plans enable row level security;

create policy lead_scrape_jobs_member_all on public.lead_scrape_jobs
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy lead_scrape_results_member_all on public.lead_scrape_results
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy lead_scrape_people_member_all on public.lead_scrape_people
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy lead_lists_member_all on public.lead_lists
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy lead_list_members_member_all on public.lead_list_members
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy workspace_ai_providers_member_all on public.workspace_ai_providers
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy quote_engagement_events_member_all on public.quote_engagement_events
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy contracts_member_all on public.contracts
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy notifications_member_all on public.notifications
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy integration_connections_member_all on public.integration_connections
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy communications_member_all on public.communications
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy meetings_member_all on public.meetings
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy sequences_member_all on public.sequences
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy sequence_steps_member_all on public.sequence_steps
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy sequence_enrollments_member_all on public.sequence_enrollments
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy account_plans_member_all on public.account_plans
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
