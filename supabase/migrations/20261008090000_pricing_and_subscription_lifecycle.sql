-- Productized pricing, capacity entitlements, and subscription lifecycle data.
-- Sources, scrape runs, and AI actions are intentionally unlimited on every plan.

update public.plans set is_public = false where slug = 'beta';

insert into public.plans as existing_plan (
  slot, name, slug, is_public, is_free, price_monthly, price_yearly,
  trial_days, quotas, features, sort_order, badge
)
values
  (1, 'Free', 'free', true, true, 0, 0, 0,
   '{"seats":1,"quotes_per_month":5,"ai_briefs_per_month":-1,"concurrent_scrape_runs":1,"raw_data_retention_days":7}'::jsonb,
   '{"sources":true,"scraping":true,"lead_scrape":true,"data_library":true,"leads":true,"lists":false,"companies":true,"contacts":true,"deals":false,"tasks":true,"quotes":true,"product_modules":false,"contracts":false,"inbox":false,"calendar":false,"sequences":false,"team":false,"crm_integrations":false,"mcp_access":false,"byok_ai":false,"ai_agent":true,"export_docx":false,"custom_branding":false}'::jsonb,
   1, 'Free forever'),
  (2, 'Starter', 'starter', true, false, 900, 9000, 0,
   '{"seats":1,"quotes_per_month":30,"ai_briefs_per_month":-1,"concurrent_scrape_runs":1,"raw_data_retention_days":30}'::jsonb,
   '{"sources":true,"scraping":true,"lead_scrape":true,"data_library":true,"leads":true,"lists":false,"companies":true,"contacts":true,"deals":true,"tasks":true,"quotes":true,"product_modules":true,"contracts":true,"inbox":true,"calendar":true,"sequences":false,"team":false,"crm_integrations":false,"mcp_access":true,"byok_ai":true,"ai_agent":true,"export_docx":true,"custom_branding":false}'::jsonb,
   2, ''),
  (3, 'Pro', 'pro', true, false, 1900, 19000, 0,
   '{"seats":5,"quotes_per_month":-1,"ai_briefs_per_month":-1,"concurrent_scrape_runs":3,"raw_data_retention_days":180}'::jsonb,
   '{"sources":true,"scraping":true,"lead_scrape":true,"data_library":true,"leads":true,"lists":false,"companies":true,"contacts":true,"deals":true,"tasks":true,"quotes":true,"product_modules":true,"contracts":true,"inbox":true,"calendar":true,"sequences":true,"team":true,"crm_integrations":true,"mcp_access":true,"byok_ai":true,"ai_agent":true,"export_docx":true,"custom_branding":true}'::jsonb,
   3, 'Most popular'),
  (4, 'Business', 'business', true, false, 4900, 49000, 0,
   '{"seats":20,"quotes_per_month":-1,"ai_briefs_per_month":-1,"concurrent_scrape_runs":10,"raw_data_retention_days":365}'::jsonb,
   '{"sources":true,"scraping":true,"lead_scrape":true,"data_library":true,"leads":true,"lists":false,"companies":true,"contacts":true,"deals":true,"tasks":true,"quotes":true,"product_modules":true,"contracts":true,"inbox":true,"calendar":true,"sequences":true,"team":true,"crm_integrations":true,"mcp_access":true,"byok_ai":true,"ai_agent":true,"export_docx":true,"custom_branding":true}'::jsonb,
   4, 'Best value')
on conflict (slug) do update set
  name = excluded.name,
  is_public = excluded.is_public,
  is_free = excluded.is_free,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  trial_days = excluded.trial_days,
  quotas = excluded.quotas,
  features = excluded.features,
  sort_order = excluded.sort_order,
  badge = excluded.badge,
  entitlement_version = existing_plan.entitlement_version + 1,
  updated_at = now();

-- SePay prices double as the provider-neutral public USD catalog. Stripe and
-- PayPal rows continue to be created by the admin catalog sync with real IDs.
insert into public.billing_provider_prices (
  plan_id, provider, billing_interval, currency, amount, external_price_id, active
)
select p.id, 'sepay', cycle.interval, 'USD', cycle.amount,
       'sepay:' || p.slug || ':' || cycle.interval, true
from public.plans p
join (values
  ('starter', 'monthly', 900), ('starter', 'yearly', 9000),
  ('pro', 'monthly', 1900), ('pro', 'yearly', 19000),
  ('business', 'monthly', 4900), ('business', 'yearly', 49000)
) as cycle(slug, interval, amount) on cycle.slug = p.slug
on conflict (plan_id, provider, billing_interval) do update set
  currency = excluded.currency,
  amount = excluded.amount,
  external_price_id = excluded.external_price_id,
  active = true,
  updated_at = now();

-- Apply the intentional unlimited-AI and capacity model to existing customers.
update public.subscriptions s
set entitlement_version = p.entitlement_version,
    entitlement_snapshot = jsonb_build_object(
      'version', p.entitlement_version,
      'quotas', p.quotas,
      'features', p.features
    )
from public.plans p
where p.id = s.plan_id;

alter table public.subscriptions
  add column if not exists scheduled_plan_id uuid references public.plans (id),
  add column if not exists scheduled_change_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists provider_event_at timestamptz;

-- Provider webhooks also use pending and suspended while access is withheld.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending', 'trialing', 'active', 'past_due', 'suspended', 'expired', 'canceled'));

-- A failed checkout remains visible for support and can be retried safely.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('pending', 'paid', 'failed', 'expired', 'cancelled'));

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  event_type text not null,
  from_plan_id uuid references public.plans (id),
  to_plan_id uuid references public.plans (id),
  provider text,
  external_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_workspace_created_idx
  on public.subscription_events (workspace_id, created_at desc);

alter table public.subscription_events enable row level security;

create policy subscription_events_select_members on public.subscription_events
  for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = subscription_events.workspace_id
        and wm.user_id = auth.uid()
    )
    or public.is_platform_admin()
  );

create policy subscription_events_insert_owner on public.subscription_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = subscription_events.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create or replace function public.apply_sepay_invoice_payment(
  p_invoice_id uuid,
  p_sepay_id text,
  p_channel text,
  p_amount integer,
  p_raw jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_invoice public.invoices%rowtype;
  existing_subscription public.subscriptions%rowtype;
  saved_subscription_id uuid;
  period_start timestamptz;
  period_end timestamptz;
  workspace_deactivated_at timestamptz;
begin
  if exists (
    select 1 from public.payments
    where sepay_id = p_sepay_id
       or (provider = 'sepay' and external_payment_id = p_sepay_id)
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select * into selected_invoice from public.invoices
  where id = p_invoice_id
  for update;
  if not found or selected_invoice.status <> 'pending' then
    raise exception 'invoice_not_payable';
  end if;
  if p_amount < selected_invoice.amount then
    raise exception 'amount_too_low';
  end if;

  insert into public.payments (
    invoice_id, sepay_id, provider, external_payment_id, channel,
    amount, currency, raw
  ) values (
    selected_invoice.id, p_sepay_id, 'sepay', p_sepay_id, p_channel,
    p_amount, selected_invoice.currency, p_raw
  );

  update public.invoices
  set status = 'paid', provider_status = 'paid', paid_at = now()
  where id = selected_invoice.id;

  select * into existing_subscription from public.subscriptions
  where workspace_id = selected_invoice.workspace_id
  for update;
  period_start := greatest(now(), coalesce(existing_subscription.current_period_end, now()));
  period_end := period_start + case when selected_invoice.billing_interval = 'yearly'
    then interval '1 year' else interval '1 month' end;

  insert into public.subscriptions (
    workspace_id, plan_id, status, provider, provider_status,
    billing_interval, current_period_start, current_period_end,
    cancel_at_period_end, grace_ends_at, canceled_at, ended_at,
    provider_event_at
  ) values (
    selected_invoice.workspace_id, selected_invoice.plan_id, 'active', 'sepay', 'paid',
    selected_invoice.billing_interval, period_start, period_end,
    false, null, null, null, now()
  )
  on conflict (workspace_id) do update set
    plan_id = excluded.plan_id,
    status = excluded.status,
    provider = excluded.provider,
    provider_status = excluded.provider_status,
    external_customer_id = null,
    external_subscription_id = null,
    external_plan_id = null,
    billing_interval = excluded.billing_interval,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false,
    grace_ends_at = null,
    canceled_at = null,
    ended_at = null,
    provider_event_at = now()
  returning id into saved_subscription_id;

  select plan_deactivated_at into workspace_deactivated_at
  from public.workspaces where id = selected_invoice.workspace_id;
  update public.workspaces
  set plan_id = selected_invoice.plan_id,
      plan_status = case when workspace_deactivated_at is null then 'active' else 'canceled' end
  where id = selected_invoice.workspace_id;

  insert into public.subscription_events (
    workspace_id, subscription_id, event_type, from_plan_id, to_plan_id,
    provider, metadata
  ) values (
    selected_invoice.workspace_id, saved_subscription_id, 'sepay_payment_applied',
    existing_subscription.plan_id, selected_invoice.plan_id, 'sepay',
    jsonb_build_object('invoice_id', selected_invoice.id, 'payment_id', p_sepay_id, 'period_end', period_end)
  );

  return jsonb_build_object('ok', true, 'period_end', period_end);
end;
$$;

revoke all on function public.apply_sepay_invoice_payment(uuid, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.apply_sepay_invoice_payment(uuid, text, text, integer, jsonb) to service_role;

-- Replace the old global one-job rule with the concurrency capacity stored in
-- the workspace's effective entitlement snapshot. Total scrape runs remain unlimited.
drop index if exists public.lead_scrape_jobs_one_active_uidx;

create or replace function public.enforce_scrape_concurrency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
  allowed_count integer;
begin
  if new.status not in ('queued', 'running', 'ingesting') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('queued', 'running', 'ingesting') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));

  select greatest(1, coalesce(
    nullif(o.quotas->>'concurrent_scrape_runs', '')::integer,
    case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
      then nullif(s.entitlement_snapshot->'quotas'->>'concurrent_scrape_runs', '')::integer end,
    nullif(p.quotas->>'concurrent_scrape_runs', '')::integer,
    1
  )) into allowed_count
  from public.workspaces w
  join public.plans p on p.id = w.plan_id
  left join public.subscriptions s on s.workspace_id = w.id
  left join public.workspace_overrides o on o.workspace_id = w.id
  where w.id = new.workspace_id;

  select count(*) into active_count
  from public.lead_scrape_jobs j
  where j.workspace_id = new.workspace_id
    and j.status in ('queued', 'running', 'ingesting')
    and j.id is distinct from new.id;

  if active_count >= coalesce(allowed_count, 1) then
    raise exception using
      errcode = 'P0001',
      message = 'scrape_concurrency_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists lead_scrape_jobs_enforce_concurrency on public.lead_scrape_jobs;
create trigger lead_scrape_jobs_enforce_concurrency
before insert or update of status on public.lead_scrape_jobs
for each row execute function public.enforce_scrape_concurrency();

create or replace function public.prune_expired_scrape_results()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  with effective_retention as (
    select w.id as workspace_id,
      greatest(1, coalesce(
        nullif(o.quotas->>'raw_data_retention_days', '')::integer,
        case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
          then nullif(s.entitlement_snapshot->'quotas'->>'raw_data_retention_days', '')::integer end,
        nullif(p.quotas->>'raw_data_retention_days', '')::integer,
        7
      )) as retention_days
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
  )
  delete from public.lead_scrape_results r
  using public.lead_scrape_jobs j, effective_retention e
  where r.job_id = j.id
    and j.workspace_id = e.workspace_id
    and j.status in ('succeeded', 'failed', 'canceled')
    and coalesce(j.finished_at, j.updated_at) < now() - make_interval(days => e.retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_expired_scrape_results() from public, anon, authenticated;
grant execute on function public.prune_expired_scrape_results() to service_role;
