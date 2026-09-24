-- Leadely V2 Phase 1A: CRM foundation (additive, non-destructive).
-- Does not migrate clients/quotes and does not add scrape/list/BYOK tables.

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  domain text not null default '',
  website text not null default '',
  industry text not null default '',
  company_size text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  tax_code text not null default '',
  logo_path text not null default '',
  owner_user_id uuid references public.profiles (id) on delete set null,
  lifecycle_stage text not null default 'prospect'
    check (lifecycle_stage in ('prospect', 'active_opportunity', 'customer', 'partner', 'inactive')),
  lead_source text not null default '',
  notes text not null default '',
  legacy_client_id uuid references public.clients (id) on delete set null,
  external_place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_workspace_id_idx on public.companies (workspace_id);
create unique index companies_workspace_legacy_client_uidx
  on public.companies (workspace_id, legacy_client_id)
  where legacy_client_id is not null;
create unique index companies_workspace_place_uidx
  on public.companies (workspace_id, external_place_id)
  where external_place_id is not null;

create trigger companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  email text not null default '',
  phone text not null default '',
  job_title text not null default '',
  linkedin_url text not null default '',
  owner_user_id uuid references public.profiles (id) on delete set null,
  relationship_strength text not null default 'unknown'
    check (relationship_strength in ('unknown', 'weak', 'developing', 'strong')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_id_idx on public.contacts (workspace_id);
create index contacts_company_id_idx on public.contacts (company_id);

create trigger contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pipelines
-- ---------------------------------------------------------------------------

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  kind text not null default 'sales' check (kind in ('sales', 'partnership', 'custom')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pipelines_workspace_id_idx on public.pipelines (workspace_id);
create unique index pipelines_one_default_uidx
  on public.pipelines (workspace_id)
  where is_default;

create trigger pipelines_updated_at
before update on public.pipelines
for each row execute function public.set_updated_at();

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  probability integer not null default 0 check (probability between 0 and 100),
  stage_type text not null default 'open' check (stage_type in ('open', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pipeline_stages_workspace_id_idx on public.pipeline_stages (workspace_id);
create index pipeline_stages_pipeline_id_idx on public.pipeline_stages (pipeline_id);
create unique index pipeline_stages_position_uidx on public.pipeline_stages (pipeline_id, position);

create trigger pipeline_stages_updated_at
before update on public.pipeline_stages
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads (converted_deal_id FK added after deals)
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'new'
    check (status in ('new', 'working', 'connected', 'qualified', 'unqualified')),
  source text not null default '',
  score integer,
  score_reason text,
  next_action_at timestamptz,
  last_activity_at timestamptz,
  converted_deal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_workspace_id_idx on public.leads (workspace_id);
create index leads_company_id_idx on public.leads (company_id);
create index leads_status_idx on public.leads (workspace_id, status);

create trigger leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  primary_contact_id uuid references public.contacts (id) on delete set null,
  pipeline_id uuid not null references public.pipelines (id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,
  owner_user_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null default '',
  deal_type text not null default 'sales'
    check (deal_type in ('sales', 'partnership', 'referral', 'strategic', 'sponsorship', 'other')),
  amount integer not null default 0,
  currency text not null default 'VND',
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  source text not null default '',
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  last_activity_at timestamptz,
  next_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_workspace_id_idx on public.deals (workspace_id);
create index deals_company_id_idx on public.deals (company_id);
create index deals_stage_id_idx on public.deals (stage_id);
create index deals_pipeline_id_idx on public.deals (pipeline_id);

create trigger deals_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

alter table public.leads
  add constraint leads_converted_deal_id_fkey
  foreign key (converted_deal_id) references public.deals (id) on delete set null;

create table public.deal_contacts (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  stakeholder_role text not null default 'other'
    check (stakeholder_role in (
      'decision_maker', 'champion', 'economic_buyer', 'technical_evaluator',
      'procurement', 'influencer', 'end_user', 'partner', 'other'
    )),
  influence_level text not null default 'unknown'
    check (influence_level in ('unknown', 'low', 'medium', 'high')),
  relationship_strength text not null default 'unknown'
    check (relationship_strength in ('unknown', 'weak', 'developing', 'strong')),
  is_primary boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (deal_id, contact_id)
);

create index deal_contacts_workspace_id_idx on public.deal_contacts (workspace_id);
create index deal_contacts_contact_id_idx on public.deal_contacts (contact_id);
create unique index deal_contacts_one_primary_uidx
  on public.deal_contacts (deal_id)
  where is_primary;

create trigger deal_contacts_updated_at
before update on public.deal_contacts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  type text not null default 'follow_up'
    check (type in ('follow_up', 'call', 'email', 'meeting', 'proposal', 'review', 'other')),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'completed', 'canceled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_workspace_id_idx on public.tasks (workspace_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to, status);
create index tasks_deal_id_idx on public.tasks (deal_id);
create index tasks_due_at_idx on public.tasks (workspace_id, due_at);

create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  activity_type text not null check (activity_type in (
    'note', 'call', 'meeting', 'email_sent', 'email_received',
    'lead_created', 'lead_qualified', 'deal_created', 'stage_changed',
    'quote_created', 'quote_sent', 'quote_viewed', 'quote_accepted', 'quote_rejected',
    'task_created', 'task_completed', 'contract_created', 'contract_signed', 'ai_recommendation'
  )),
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  is_system boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activities_workspace_id_idx on public.activities (workspace_id, occurred_at desc);
create index activities_company_id_idx on public.activities (company_id, occurred_at desc);
create index activities_deal_id_idx on public.activities (deal_id, occurred_at desc);
create index activities_lead_id_idx on public.activities (lead_id, occurred_at desc);
create index activities_contact_id_idx on public.activities (contact_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Seed default sales pipeline
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_sales_pipeline(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  if exists (
    select 1 from public.pipelines
    where workspace_id = p_workspace_id and is_default
  ) then
    return;
  end if;

  insert into public.pipelines (workspace_id, name, kind, is_default)
  values (p_workspace_id, 'Default Sales Pipeline', 'sales', true)
  returning id into v_pipeline_id;

  insert into public.pipeline_stages (workspace_id, pipeline_id, name, position, probability, stage_type)
  values
    (p_workspace_id, v_pipeline_id, 'New Lead', 1, 10, 'open'),
    (p_workspace_id, v_pipeline_id, 'Contacted', 2, 20, 'open'),
    (p_workspace_id, v_pipeline_id, 'Qualified', 3, 35, 'open'),
    (p_workspace_id, v_pipeline_id, 'Discovery', 4, 50, 'open'),
    (p_workspace_id, v_pipeline_id, 'Proposal', 5, 65, 'open'),
    (p_workspace_id, v_pipeline_id, 'Negotiation', 6, 80, 'open'),
    (p_workspace_id, v_pipeline_id, 'Won', 7, 100, 'won'),
    (p_workspace_id, v_pipeline_id, 'Lost', 8, 0, 'lost');
end;
$$;

create or replace function public.seed_pipeline_on_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_sales_pipeline(new.id);
  return new;
end;
$$;

create trigger workspaces_seed_default_pipeline
after insert on public.workspaces
for each row execute function public.seed_pipeline_on_workspace();

select public.seed_default_sales_pipeline(id) from public.workspaces;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.deal_contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

create policy companies_member_all on public.companies
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy contacts_member_all on public.contacts
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy pipelines_member_all on public.pipelines
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy pipeline_stages_member_all on public.pipeline_stages
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy leads_member_all on public.leads
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy deals_member_all on public.deals
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy deal_contacts_member_all on public.deal_contacts
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy tasks_member_all on public.tasks
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy activities_member_all on public.activities
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
