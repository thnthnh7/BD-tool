-- Close entitlement gaps introduced after the first hardening pass.

create or replace function public.subscription_access_valid(
  p_status text,
  p_current_period_end timestamptz,
  p_grace_ends_at timestamptz,
  p_grace_days integer default 0
) returns boolean
language sql
stable
set search_path = public
as $$
  select p_status in ('active', 'trialing', 'past_due')
    and p_current_period_end is not null
    and now() <= coalesce(
      p_grace_ends_at,
      p_current_period_end + make_interval(days => greatest(coalesce(p_grace_days, 0), 0))
    );
$$;

revoke all on function public.subscription_access_valid(text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.subscription_access_valid(text, timestamptz, timestamptz, integer) to authenticated, service_role;

update public.plans
set quotas = jsonb_set(
  coalesce(quotas, '{}'::jsonb),
  '{client_workspaces}',
  to_jsonb(case slug when 'pro' then 3 when 'business' then 10 when 'beta' then 10 else 0 end),
  true
), updated_at = now();

-- Free currently has no platform-funded AI provider and does not allow BYOK,
-- so advertising ai_agent there creates an entitlement that cannot execute.
update public.plans
set features = jsonb_set(coalesce(features, '{}'::jsonb), '{ai_agent}', 'false'::jsonb, true),
    updated_at = now()
where slug = 'free';

update public.subscriptions s
set entitlement_snapshot = jsonb_set(
  jsonb_set(
    coalesce(s.entitlement_snapshot, '{}'::jsonb),
    '{quotas,client_workspaces}',
    to_jsonb(case p.slug when 'pro' then 3 when 'business' then 10 when 'beta' then 10 else 0 end),
    true
  ),
  '{features,ai_agent}',
  case when p.slug = 'free' then 'false'::jsonb else coalesce(s.entitlement_snapshot -> 'features' -> 'ai_agent', p.features -> 'ai_agent', 'false'::jsonb) end,
  true
)
from public.plans p
where p.id = s.plan_id and s.entitlement_snapshot is not null;

create or replace function public.workspace_feature_enabled(p_workspace_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.role() = 'service_role'
    or public.is_platform_admin()
    or public.has_workspace_seat(p_workspace_id, auth.uid())
  ) and coalesce((
    select (
      p_feature = 'custom_branding'
      or coalesce(
        case when jsonb_typeof(o.features -> p_feature) = 'boolean' then (o.features ->> p_feature)::boolean end,
        case when s.plan_id = w.plan_id
          and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)
          and jsonb_typeof(s.entitlement_snapshot -> 'features' -> p_feature) = 'boolean'
          then (s.entitlement_snapshot -> 'features' ->> p_feature)::boolean end,
        case when (p.is_free or (s.plan_id = w.plan_id
          and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
          and jsonb_typeof(p.features -> p_feature) = 'boolean'
          then (p.features ->> p_feature)::boolean end,
        false
      )
    )
    and not w.locked
    and w.archived_at is null
    and w.plan_status in ('active', 'trialing', 'past_due')
    and (p.is_free or (s.plan_id = w.plan_id
      and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

create or replace function public.workspace_quota_limit(p_workspace_id uuid, p_quota text, p_fallback integer default 0)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select coalesce(
      case when jsonb_typeof(o.quotas -> p_quota) = 'number' then (o.quotas ->> p_quota)::integer end,
      case when s.plan_id = w.plan_id
        and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)
        and jsonb_typeof(s.entitlement_snapshot -> 'quotas' -> p_quota) = 'number'
        then (s.entitlement_snapshot -> 'quotas' ->> p_quota)::integer end,
      case when (p.is_free or (s.plan_id = w.plan_id
        and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
        and jsonb_typeof(p.quotas -> p_quota) = 'number'
        then (p.quotas ->> p_quota)::integer end,
      p_fallback
    )
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), p_fallback);
$$;

create or replace function public.workspace_team_enabled_internal(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select coalesce(
      case when jsonb_typeof(o.features -> 'team') = 'boolean' then (o.features ->> 'team')::boolean end,
      case when s.plan_id = w.plan_id
        and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)
        and jsonb_typeof(s.entitlement_snapshot -> 'features' -> 'team') = 'boolean'
        then (s.entitlement_snapshot -> 'features' ->> 'team')::boolean end,
      case when (p.is_free or (s.plan_id = w.plan_id
        and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
        and jsonb_typeof(p.features -> 'team') = 'boolean'
        then (p.features ->> 'team')::boolean end,
      false
    ) and not w.locked and w.archived_at is null and w.plan_status in ('active', 'trialing', 'past_due')
      and (p.is_free or (s.plan_id = w.plan_id
        and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

alter table public.workspaces
  add column if not exists parent_workspace_id uuid references public.workspaces(id) on delete restrict;
create index if not exists workspaces_parent_workspace_idx on public.workspaces(parent_workspace_id, created_at, id);

create or replace function public.workspace_client_plan_access_enabled(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select child.parent_workspace_id is null or (
      public.workspace_team_enabled_internal(child.parent_workspace_id)
      and public.workspace_quota_limit(child.parent_workspace_id, 'client_workspaces', 0) >= (
        select count(*)::integer from public.workspaces sibling
        where sibling.parent_workspace_id = child.parent_workspace_id
          and (sibling.created_at, sibling.id) <= (child.created_at, child.id)
      )
    )
    from public.workspaces child where child.id = p_workspace_id
  ), false);
$$;

revoke all on function public.workspace_client_plan_access_enabled(uuid) from public, anon;
grant execute on function public.workspace_client_plan_access_enabled(uuid) to authenticated, service_role;

create or replace function public.workspace_client_access_enabled(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.workspace_client_plan_access_enabled(child.id) and (child.parent_workspace_id is null or (
      exists (
        select 1 from public.workspace_members parent_member
        where parent_member.workspace_id = child.parent_workspace_id
          and parent_member.user_id = p_user_id
          and parent_member.role in ('owner', 'admin')
      )
    ))
    from public.workspaces child where child.id = p_workspace_id
  ), false);
$$;

revoke all on function public.workspace_client_access_enabled(uuid, uuid) from public, anon;
grant execute on function public.workspace_client_access_enabled(uuid, uuid) to authenticated, service_role;

create or replace function public.has_workspace_seat(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select wm.user_id,
      row_number() over (order by case when wm.role = 'owner' then 0 else 1 end, wm.seat_priority_at, wm.user_id) as seat_rank
    from public.workspace_members wm where wm.workspace_id = p_workspace_id
  ), seat_limit as (
    select public.workspace_seat_limit(p_workspace_id) as value
  )
  select public.workspace_client_access_enabled(p_workspace_id, p_user_id) and exists (
    select 1 from ranked, seat_limit
    where ranked.user_id = p_user_id and (seat_limit.value < 0 or ranked.seat_rank <= seat_limit.value)
  );
$$;

-- Rebind the central feature check after client-workspace helpers exist so
-- service-role workers cannot continue paid work for a child whose parent
-- entitlement was downgraded or exceeded.
create or replace function public.workspace_feature_enabled(p_workspace_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.role() = 'service_role'
    or public.is_platform_admin()
    or public.has_workspace_seat(p_workspace_id, auth.uid())
  ) and public.workspace_client_plan_access_enabled(p_workspace_id) and coalesce((
    select (
      p_feature = 'custom_branding'
      or coalesce(
        case when jsonb_typeof(o.features -> p_feature) = 'boolean' then (o.features ->> p_feature)::boolean end,
        case when s.plan_id = w.plan_id
          and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)
          and jsonb_typeof(s.entitlement_snapshot -> 'features' -> p_feature) = 'boolean'
          then (s.entitlement_snapshot -> 'features' ->> p_feature)::boolean end,
        case when (p.is_free or (s.plan_id = w.plan_id
          and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
          and jsonb_typeof(p.features -> p_feature) = 'boolean'
          then (p.features ->> p_feature)::boolean end,
        false
      )
    )
    and not w.locked
    and w.archived_at is null
    and w.plan_status in ('active', 'trialing', 'past_due')
    and (p.is_free or (s.plan_id = w.plan_id
      and public.subscription_access_valid(s.status, s.current_period_end, s.grace_ends_at, s.grace_days)))
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.user_id = auth.uid() and public.has_workspace_seat(wm.workspace_id, wm.user_id)
  order by (wm.workspace_id = p.active_workspace_id) desc, (wm.role = 'owner') desc, wm.created_at, wm.workspace_id
  limit 1;
$$;

create or replace function public.create_agency_workspace(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  source_workspace_id uuid := public.current_workspace_id();
  free_plan public.plans%rowtype;
  workspace_limit integer;
  used_workspaces integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'workspace_name_required'; end if;
  if source_workspace_id is null then raise exception 'agency_workspace_forbidden'; end if;
  if exists (select 1 from public.workspaces where id = source_workspace_id and parent_workspace_id is not null) then
    raise exception 'nested_client_workspace_forbidden';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = source_workspace_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'agency_workspace_forbidden'; end if;
  if not public.workspace_team_enabled_internal(source_workspace_id) then raise exception 'client_workspaces_not_available'; end if;

  perform pg_advisory_xact_lock(hashtextextended(source_workspace_id::text, 0));
  workspace_limit := public.workspace_quota_limit(source_workspace_id, 'client_workspaces', 0);
  select count(*) into used_workspaces from public.workspaces where parent_workspace_id = source_workspace_id;
  if workspace_limit < 1 or used_workspaces >= workspace_limit then raise exception 'workspace_limit_reached'; end if;

  select * into free_plan from public.plans where is_public and is_free order by sort_order limit 1;
  if free_plan.id is null then raise exception 'free_plan_not_configured'; end if;
  insert into public.workspaces (id, type, name, slug, plan_id, plan_status, parent_workspace_id)
  values (new_workspace_id, 'company', trim(p_name), p_slug, free_plan.id, 'active', source_workspace_id);
  insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, auth.uid(), 'owner');
  insert into public.subscriptions (workspace_id, plan_id, status, billing_interval, current_period_start, current_period_end)
  values (new_workspace_id, free_plan.id, 'active', 'monthly', now(), now() + interval '10 years');
  insert into public.workspace_settings (workspace_id, company_name, short_name, email)
  values (new_workspace_id, trim(p_name), trim(p_name), coalesce(auth.jwt() ->> 'email', ''));
  insert into public.modules (workspace_id, name, category, description, suggested_price, default_qty, visual_hint)
  select new_workspace_id, name, category, description, suggested_price, default_qty, visual_hint from public.module_templates order by sort_order;
  update public.profiles set active_workspace_id = new_workspace_id where id = auth.uid();
  return new_workspace_id;
end;
$$;

create or replace function public.list_my_workspaces()
returns table (id uuid, name text, type text, role text, provider_cost_usd numeric)
language sql stable security definer set search_path = public
as $$
  select w.id, w.name, w.type, wm.role,
    coalesce(sum(greatest(coalesce(j.apify_usage_usd, 0), 0)), 0)::numeric
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  left join public.lead_scrape_jobs j on j.workspace_id = w.id
  where wm.user_id = auth.uid() and w.archived_at is null
    and public.has_workspace_seat(w.id, wm.user_id)
  group by w.id, w.name, w.type, wm.role
  order by w.name;
$$;

-- Feature tables added after the original entitlement migration must also
-- fail closed for direct PostgREST access.
do $$
declare table_name text;
begin
  foreach table_name in array array['data_suppressions', 'data_import_batches', 'data_import_items'] loop
    execute format('drop policy if exists entitlement_restrict_%I on public.%I', table_name, table_name);
    execute format(
      'create policy entitlement_restrict_%I on public.%I as restrictive for all to authenticated using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L)) with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L))',
      table_name, table_name, 'data_library', 'data_library'
    );
  end loop;
  foreach table_name in array array['actor_input_drafts', 'actor_guidance_events', 'workspace_provider_budgets'] loop
    execute format('drop policy if exists entitlement_restrict_%I on public.%I', table_name, table_name);
    execute format(
      'create policy entitlement_restrict_%I on public.%I as restrictive for all to authenticated using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L)) with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L))',
      table_name, table_name, 'scraping', 'scraping'
    );
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['engagement_accounts', 'engagement_account_audit'] loop
    execute format('drop policy if exists entitlement_restrict_%I on public.%I', table_name, table_name);
    execute format(
      'create policy entitlement_restrict_%I on public.%I as restrictive for all to authenticated using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L) or public.workspace_feature_enabled(workspace_id, %L) or public.workspace_feature_enabled(workspace_id, %L)) with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L) or public.workspace_feature_enabled(workspace_id, %L) or public.workspace_feature_enabled(workspace_id, %L))',
      table_name, table_name, 'inbox', 'calendar', 'sequences', 'inbox', 'calendar', 'sequences'
    );
  end loop;
end $$;

drop policy if exists entitlement_restrict_engagement_subscriptions on public.engagement_subscriptions;
create policy entitlement_restrict_engagement_subscriptions on public.engagement_subscriptions
as restrictive for all to authenticated
using (
  public.is_platform_admin()
  or (resource = 'mail' and (public.workspace_feature_enabled(workspace_id, 'inbox') or public.workspace_feature_enabled(workspace_id, 'sequences')))
  or (resource = 'calendar' and public.workspace_feature_enabled(workspace_id, 'calendar'))
)
with check (
  public.is_platform_admin()
  or (resource = 'mail' and (public.workspace_feature_enabled(workspace_id, 'inbox') or public.workspace_feature_enabled(workspace_id, 'sequences')))
  or (resource = 'calendar' and public.workspace_feature_enabled(workspace_id, 'calendar'))
);
drop policy if exists entitlement_restrict_engagement_suppressions on public.engagement_suppressions;
create policy entitlement_restrict_engagement_suppressions on public.engagement_suppressions
as restrictive for all to authenticated
using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, 'inbox') or public.workspace_feature_enabled(workspace_id, 'sequences'))
with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, 'inbox') or public.workspace_feature_enabled(workspace_id, 'sequences'));

drop policy if exists entitlement_restrict_engagement_jobs on public.engagement_jobs;
create policy entitlement_restrict_engagement_jobs on public.engagement_jobs
as restrictive for all to authenticated
using (
  public.is_platform_admin()
  or (job_type = 'sync_mail' and public.workspace_feature_enabled(workspace_id, 'inbox'))
  or (job_type = 'sync_calendar' and public.workspace_feature_enabled(workspace_id, 'calendar'))
  or (job_type not in ('sync_mail', 'sync_calendar') and public.workspace_feature_enabled(workspace_id, 'sequences'))
)
with check (
  public.is_platform_admin()
  or (job_type = 'sync_mail' and public.workspace_feature_enabled(workspace_id, 'inbox'))
  or (job_type = 'sync_calendar' and public.workspace_feature_enabled(workspace_id, 'calendar'))
  or (job_type not in ('sync_mail', 'sync_calendar') and public.workspace_feature_enabled(workspace_id, 'sequences'))
);

