-- Time-bound, capacity-limited Beta access for verified first-workspace owners.

alter table public.subscriptions
  add column if not exists access_source text not null default 'paid'
    check (access_source in ('free', 'paid', 'beta_campaign', 'admin'));

update public.subscriptions s
set access_source = case
  when p.slug = 'free' then 'free'
  when p.slug = 'beta' then 'admin'
  else 'paid'
end
from public.plans p
where p.id = s.plan_id;

-- Beta is promotional rather than perpetual. Keeping it non-public prevents it
-- from appearing as a purchasable plan while the subscription timestamp remains
-- authoritative for access.
update public.plans beta
set is_public = false,
    is_free = false,
    price_monthly = 0,
    price_yearly = 0,
    trial_days = 0,
    quotas = business.quotas,
    features = business.features,
    entitlement_version = beta.entitlement_version + 1,
    updated_at = now()
from public.plans business
where beta.slug = 'beta' and business.slug = 'business';

create table if not exists public.beta_campaigns (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id),
  fallback_plan_id uuid not null references public.plans(id),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  max_participants integer not null default 200 check (max_participants between 1 and 100000),
  claimed_count integer not null default 0 check (claimed_count >= 0 and claimed_count <= max_participants),
  access_months integer not null default 2 check (access_months between 1 and 24),
  starts_at timestamptz not null default now(),
  enrollment_ends_at timestamptz,
  new_accounts_only boolean not null default true,
  require_verified_email boolean not null default true,
  headline text not null default 'Beta Early Access',
  description text not null default 'The first 200 members receive full Bizcraw access free for two months. No payment card required.',
  terms_url text not null default '/terms',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enrollment_ends_at is null or enrollment_ends_at > starts_at)
);

create unique index if not exists beta_campaigns_one_active_idx
  on public.beta_campaigns ((status)) where status = 'active';

create trigger beta_campaigns_updated_at
before update on public.beta_campaigns
for each row execute function public.set_updated_at();

create table if not exists public.beta_campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.beta_campaigns(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  position integer not null check (position > 0),
  status text not null default 'active' check (status in ('active', 'converted', 'expired', 'revoked')),
  granted_at timestamptz not null default now(),
  access_starts_at timestamptz not null default now(),
  access_ends_at timestamptz not null,
  converted_at timestamptz,
  converted_plan_id uuid references public.plans(id),
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id),
  unique (campaign_id, workspace_id),
  unique (campaign_id, position),
  check (access_ends_at > access_starts_at)
);

create index if not exists beta_campaign_enrollments_status_end_idx
  on public.beta_campaign_enrollments(status, access_ends_at);
create index if not exists beta_campaign_enrollments_user_idx
  on public.beta_campaign_enrollments(user_id, created_at desc);

create trigger beta_campaign_enrollments_updated_at
before update on public.beta_campaign_enrollments
for each row execute function public.set_updated_at();

alter table public.beta_campaigns enable row level security;
alter table public.beta_campaign_enrollments enable row level security;

create policy beta_campaigns_platform_read on public.beta_campaigns
  for select to authenticated using (public.is_platform_admin());
create policy beta_campaigns_super_admin_write on public.beta_campaigns
  for all to authenticated using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');
create policy beta_enrollments_member_read on public.beta_campaign_enrollments
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy beta_enrollments_super_admin_write on public.beta_campaign_enrollments
  for all to authenticated using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

insert into public.beta_campaigns (
  plan_id, fallback_plan_id, name, status, max_participants, access_months,
  starts_at, headline, description, terms_url
)
select beta.id, free.id, 'Founding Beta 200', 'draft', 200, 2, now(),
       'Beta Early Access',
       'The first 200 members receive full Bizcraw access free for two months. No payment card required.',
       '/terms'
from public.plans beta
cross join public.plans free
where beta.slug = 'beta' and free.slug = 'free'
  and not exists (select 1 from public.beta_campaigns);

-- A paid provider replacing a promotional subscription wins permanently. The
-- enrollment remains as immutable campaign history and cannot later downgrade it.
create or replace function public.guard_beta_paid_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.access_source = 'beta_campaign'
     and old.provider = 'promotion'
     and new.provider in ('stripe', 'paypal', 'sepay') then
    new.access_source := 'paid';
    if new.provider = 'sepay' then
      new.current_period_start := now();
      new.current_period_end := now() + case when new.billing_interval = 'yearly'
        then interval '1 year' else interval '1 month' end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_beta_paid_conversion_guard on public.subscriptions;
create trigger subscriptions_beta_paid_conversion_guard
before update on public.subscriptions
for each row execute function public.guard_beta_paid_conversion();

create or replace function public.sync_beta_enrollment_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.access_source = 'beta_campaign' and new.access_source = 'paid' then
    update public.beta_campaign_enrollments
    set status = 'converted', converted_at = now(), converted_plan_id = new.plan_id
    where workspace_id = new.workspace_id and status = 'active';
  elsif new.access_source = 'beta_campaign' and new.status in ('expired', 'canceled') then
    update public.beta_campaign_enrollments
    set status = 'expired'
    where workspace_id = new.workspace_id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_beta_enrollment on public.subscriptions;
create trigger subscriptions_sync_beta_enrollment
after update on public.subscriptions
for each row execute function public.sync_beta_enrollment_from_subscription();

drop function if exists public.create_workspace_onboarding(text, text, text);
create function public.create_workspace_onboarding(
  p_name text,
  p_slug text,
  p_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  free_plan public.plans%rowtype;
  beta_plan public.plans%rowtype;
  campaign public.beta_campaigns%rowtype;
  granted_position integer;
  access_end timestamptz;
  verified boolean := false;
  subscription_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'workspace_name_required'; end if;
  if p_type not in ('personal', 'company') then raise exception 'invalid_workspace_type'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if exists (select 1 from public.workspace_members where user_id = auth.uid())
     or exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'account_already_assigned';
  end if;

  select * into free_plan from public.plans
  where is_public and is_free order by sort_order limit 1;
  if free_plan.id is null then raise exception 'free_plan_not_configured'; end if;

  select email_confirmed_at is not null into verified
  from auth.users where id = auth.uid();

  select * into campaign from public.beta_campaigns
  where status = 'active'
    and starts_at <= now()
    and (enrollment_ends_at is null or enrollment_ends_at > now())
    and claimed_count < max_participants
    and not exists (
      select 1 from public.beta_campaign_enrollments e
      where e.campaign_id = beta_campaigns.id and e.user_id = auth.uid()
    )
    and (not require_verified_email or verified)
  order by starts_at, created_at
  limit 1
  for update;

  if campaign.id is not null then
    update public.beta_campaigns
    set claimed_count = claimed_count + 1
    where id = campaign.id and claimed_count < max_participants
    returning claimed_count into granted_position;
    if granted_position is not null then
      select * into beta_plan from public.plans where id = campaign.plan_id;
      access_end := now() + make_interval(months => campaign.access_months);
    end if;
  end if;

  insert into public.workspaces (id, type, name, slug, plan_id, plan_status)
  values (
    new_workspace_id, p_type, trim(p_name), p_slug,
    case when granted_position is not null then beta_plan.id else free_plan.id end,
    case when granted_position is not null then 'trialing' else 'active' end
  );
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');
  update public.profiles set active_workspace_id = new_workspace_id where id = auth.uid();

  insert into public.subscriptions (
    workspace_id, plan_id, status, provider, provider_status, access_source,
    billing_interval, current_period_start, current_period_end, grace_days,
    entitlement_version, entitlement_snapshot
  ) values (
    new_workspace_id,
    case when granted_position is not null then beta_plan.id else free_plan.id end,
    case when granted_position is not null then 'trialing' else 'active' end,
    case when granted_position is not null then 'promotion' else 'sepay' end,
    case when granted_position is not null then 'beta_active' else 'free' end,
    case when granted_position is not null then 'beta_campaign' else 'free' end,
    'monthly', now(),
    case when granted_position is not null then access_end else now() + interval '10 years' end,
    0,
    case when granted_position is not null then beta_plan.entitlement_version else free_plan.entitlement_version end,
    jsonb_build_object(
      'version', case when granted_position is not null then beta_plan.entitlement_version else free_plan.entitlement_version end,
      'quotas', case when granted_position is not null then beta_plan.quotas else free_plan.quotas end,
      'features', case when granted_position is not null then beta_plan.features else free_plan.features end
    )
  ) returning id into subscription_id;

  if granted_position is not null then
    insert into public.beta_campaign_enrollments (
      campaign_id, user_id, workspace_id, position, access_starts_at, access_ends_at
    ) values (campaign.id, auth.uid(), new_workspace_id, granted_position, now(), access_end);
    insert into public.subscription_events (
      workspace_id, subscription_id, event_type, from_plan_id, to_plan_id, provider, metadata
    ) values (
      new_workspace_id, subscription_id, 'beta_granted', free_plan.id, beta_plan.id, 'promotion',
      jsonb_build_object('campaign_id', campaign.id, 'position', granted_position, 'access_ends_at', access_end)
    );
  end if;

  insert into public.modules (
    workspace_id, name, category, description, suggested_price, default_qty, visual_hint
  )
  select new_workspace_id, name, category, description, suggested_price, default_qty, visual_hint
  from public.module_templates order by sort_order;

  return jsonb_build_object(
    'workspace_id', new_workspace_id,
    'beta_granted', granted_position is not null,
    'beta_position', granted_position,
    'beta_max_participants', campaign.max_participants,
    'beta_access_ends_at', access_end
  );
end;
$$;

revoke all on function public.create_workspace_onboarding(text, text, text) from public, anon;
grant execute on function public.create_workspace_onboarding(text, text, text) to authenticated;

create or replace function public.manage_beta_enrollment(
  p_enrollment_id uuid,
  p_action text,
  p_months integer default 1,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  enrollment public.beta_campaign_enrollments%rowtype;
  free_plan_id uuid;
  next_end timestamptz;
begin
  if public.platform_role() <> 'super_admin' then raise exception 'forbidden'; end if;
  select * into enrollment from public.beta_campaign_enrollments where id = p_enrollment_id for update;
  if enrollment.id is null then raise exception 'enrollment_not_found'; end if;

  if p_action = 'extend' then
    if enrollment.status <> 'active' then raise exception 'enrollment_not_active'; end if;
    if p_months < 1 or p_months > 24 then raise exception 'invalid_extension'; end if;
    next_end := enrollment.access_ends_at + make_interval(months => p_months);
    update public.beta_campaign_enrollments set access_ends_at = next_end where id = enrollment.id;
    update public.subscriptions set current_period_end = next_end
    where workspace_id = enrollment.workspace_id and access_source = 'beta_campaign';
  elsif p_action = 'revoke' then
    select id into free_plan_id from public.plans where is_public and is_free order by sort_order limit 1;
    update public.beta_campaign_enrollments
    set status = 'revoked', revoked_at = now(), revoke_reason = nullif(trim(p_reason), '')
    where id = enrollment.id and status = 'active';
    update public.subscriptions
    set status = 'expired', current_period_end = least(current_period_end, now()), ended_at = now()
    where workspace_id = enrollment.workspace_id and access_source = 'beta_campaign';
    update public.workspaces set plan_id = free_plan_id, plan_status = 'active'
    where id = enrollment.workspace_id;
  else
    raise exception 'invalid_action';
  end if;
end;
$$;

revoke all on function public.manage_beta_enrollment(uuid, text, integer, text) from public, anon;
grant execute on function public.manage_beta_enrollment(uuid, text, integer, text) to authenticated;
