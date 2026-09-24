-- Phase 1 data migration: clients → companies/contacts, quotes → deals. Non-destructive.

alter table public.quotes
  add column if not exists deal_id uuid references public.deals (id) on delete set null,
  add column if not exists revision_number integer not null default 1,
  add column if not exists supersedes_quote_id uuid references public.quotes (id) on delete set null,
  add column if not exists quote_status_v2 text,
  add column if not exists sent_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz;

create index if not exists quotes_deal_id_idx on public.quotes (deal_id);

update public.quotes
set quote_status_v2 = case status
  when 'sent' then 'sent'
  when 'won' then 'accepted'
  when 'lost' then 'rejected'
  else 'draft'
end
where quote_status_v2 is null;

insert into public.companies (
  workspace_id, name, website, industry, phone, email, address, tax_code, logo_path,
  lifecycle_stage, lead_source, notes, legacy_client_id
)
select
  c.workspace_id,
  c.company_name,
  '',
  c.industry,
  c.phone,
  c.email,
  c.address,
  c.tax_code,
  c.logo_url,
  'prospect',
  'legacy_client',
  c.notes,
  c.id
from public.clients c
where not exists (
  select 1 from public.companies co where co.legacy_client_id = c.id
);

insert into public.contacts (
  workspace_id, company_id, first_name, last_name, display_name, email, phone, job_title, notes
)
select
  c.workspace_id,
  co.id,
  split_part(c.contact_name, ' ', 1),
  nullif(trim(substr(c.contact_name, length(split_part(c.contact_name, ' ', 1)) + 1)), ''),
  coalesce(nullif(c.contact_name, ''), c.email, c.company_name),
  c.email,
  c.phone,
  c.representative_title,
  c.notes
from public.clients c
join public.companies co on co.legacy_client_id = c.id
where (c.contact_name <> '' or c.email <> '')
  and not exists (
    select 1 from public.contacts ct
    where ct.company_id = co.id and ct.email = c.email and c.email <> ''
  );

insert into public.companies (workspace_id, name, lead_source, notes)
select
  q.workspace_id,
  coalesce(nullif(q.title, ''), 'Migrated quote'),
  'legacy_quote',
  'legacy-quote:' || q.id::text
from public.quotes q
where q.client_id is null
  and q.deal_id is null
  and not exists (
    select 1 from public.companies co
    where co.workspace_id = q.workspace_id and co.notes = 'legacy-quote:' || q.id::text
  );

insert into public.deals (
  workspace_id, company_id, primary_contact_id, pipeline_id, stage_id, owner_user_id,
  title, description, deal_type, amount, currency, probability, source, won_at, lost_at
)
select
  q.workspace_id,
  co.id,
  ct.id,
  p.id,
  st.id,
  wm.user_id,
  coalesce(nullif(q.title, ''), 'Migrated quote'),
  coalesce(q.project_overview, ''),
  'sales',
  0,
  q.currency,
  st.probability,
  'legacy_quote:' || q.id::text,
  case when q.status = 'won' then q.updated_at else null end,
  case when q.status = 'lost' then q.updated_at else null end
from public.quotes q
join public.pipelines p
  on p.workspace_id = q.workspace_id and p.is_default
join public.pipeline_stages st
  on st.pipeline_id = p.id
 and st.name = case q.status
   when 'won' then 'Won'
   when 'lost' then 'Lost'
   else 'Proposal'
 end
left join public.companies co
  on co.legacy_client_id = q.client_id
  or (q.client_id is null and co.notes = 'legacy-quote:' || q.id::text)
left join lateral (
  select id from public.contacts
  where company_id = co.id
  order by created_at
  limit 1
) ct on true
left join lateral (
  select user_id from public.workspace_members
  where workspace_id = q.workspace_id and role = 'owner'
  limit 1
) wm on true
where q.deal_id is null
  and co.id is not null;

update public.quotes q
set deal_id = d.id
from public.deals d
where q.deal_id is null
  and d.source = 'legacy_quote:' || q.id::text;
