-- Enforce commercial entitlements at the database boundary. UI and Server
-- Action checks remain useful for UX, but authenticated REST calls must not be
-- able to create their own plan, mutate billing state, or access paid modules.

create or replace function public.workspace_feature_enabled(
  p_workspace_id uuid,
  p_feature text
) returns boolean
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
    select coalesce(
      case when jsonb_typeof(o.features -> p_feature) = 'boolean'
        then (o.features ->> p_feature)::boolean end,
      case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
        and jsonb_typeof(s.entitlement_snapshot -> 'features' -> p_feature) = 'boolean'
        then (s.entitlement_snapshot -> 'features' ->> p_feature)::boolean end,
      case when (p.is_free or (s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')))
        and jsonb_typeof(p.features -> p_feature) = 'boolean'
        then (p.features ->> p_feature)::boolean end,
      false
    )
    and not w.locked
    and w.archived_at is null
    and w.plan_status in ('active', 'trialing', 'past_due')
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

create or replace function public.workspace_quota_limit(
  p_workspace_id uuid,
  p_quota text,
  p_fallback integer default 0
) returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when
    auth.role() = 'service_role'
    or public.is_platform_admin()
    or public.has_workspace_seat(p_workspace_id, auth.uid())
  then coalesce((
    select coalesce(
      nullif(o.quotas ->> p_quota, '')::integer,
      case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
        then nullif(s.entitlement_snapshot -> 'quotas' ->> p_quota, '')::integer end,
      case when p.is_free or (s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due'))
        then nullif(p.quotas ->> p_quota, '')::integer end,
      p_fallback
    )
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
      and not w.locked
      and w.archived_at is null
      and w.plan_status in ('active', 'trialing', 'past_due')
  ), p_fallback) else null end;
$$;

revoke all on function public.workspace_feature_enabled(uuid, text) from public, anon;
revoke all on function public.workspace_quota_limit(uuid, text, integer) from public, anon;
grant execute on function public.workspace_feature_enabled(uuid, text) to authenticated, service_role;
grant execute on function public.workspace_quota_limit(uuid, text, integer) to authenticated, service_role;

-- Workspace creation is an atomic trusted operation and always starts on the
-- configured public Free plan. Paid plan selection only creates a checkout.
create or replace function public.create_workspace_onboarding(
  p_name text,
  p_slug text,
  p_type text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  free_plan public.plans%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'workspace_name_required'; end if;
  if p_type not in ('personal', 'company') then raise exception 'invalid_workspace_type'; end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid())
     or exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'account_already_assigned';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if exists (select 1 from public.workspace_members where user_id = auth.uid())
     or exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'account_already_assigned';
  end if;

  select * into free_plan from public.plans
  where is_public and is_free
  order by sort_order
  limit 1;
  if free_plan.id is null then raise exception 'free_plan_not_configured'; end if;

  insert into public.workspaces (id, type, name, slug, plan_id, plan_status)
  values (new_workspace_id, p_type, trim(p_name), p_slug, free_plan.id, 'active');
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');
  insert into public.subscriptions (
    workspace_id, plan_id, status, billing_interval,
    current_period_start, current_period_end
  ) values (
    new_workspace_id, free_plan.id, 'active', 'monthly', now(), now() + interval '10 years'
  );
  insert into public.modules (
    workspace_id, name, category, description, suggested_price, default_qty, visual_hint
  )
  select new_workspace_id, name, category, description, suggested_price, default_qty, visual_hint
  from public.module_templates
  order by sort_order;
  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_onboarding(text, text, text) from public, anon;
grant execute on function public.create_workspace_onboarding(text, text, text) to authenticated;

-- Billing and ownership rows are server/RPC managed. SELECT remains governed
-- by RLS so owners can still view their subscription and invoices.
revoke insert on public.workspaces from authenticated;
revoke insert on public.workspace_members from authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.subscription_events from authenticated;
revoke insert, update, delete on public.invoices from authenticated;

-- Add restrictive policies alongside the existing tenant policies. PostgreSQL
-- combines restrictive policies with AND, closing direct PostgREST bypasses.
do $$
declare
  entitlement record;
  policy_name text;
begin
  for entitlement in
    select * from (values
      ('workspace_scrape_sources', 'sources'),
      ('data_collections', 'data_library'),
      ('data_records', 'data_library'),
      ('data_assets', 'data_library'),
      ('data_record_links', 'data_library'),
      ('leads', 'leads'),
      ('lead_lists', 'lists'),
      ('lead_list_members', 'lists'),
      ('companies', 'companies'),
      ('contacts', 'contacts'),
      ('pipelines', 'deals'),
      ('pipeline_stages', 'deals'),
      ('deals', 'deals'),
      ('deal_contacts', 'deals'),
      ('tasks', 'tasks'),
      ('clients', 'quotes'),
      ('quotes', 'quotes'),
      ('public_quotes', 'quotes'),
      ('quote_engagement_events', 'quotes'),
      ('modules', 'product_modules'),
      ('knowledge_documents', 'product_modules'),
      ('knowledge_chunks', 'product_modules'),
      ('knowledge_module_drafts', 'product_modules'),
      ('contracts', 'contracts'),
      ('communications', 'inbox'),
      ('integration_connections', 'inbox'),
      ('meetings', 'calendar'),
      ('sequences', 'sequences'),
      ('sequence_steps', 'sequences'),
      ('sequence_enrollments', 'sequences'),
      ('crm_connections', 'crm_integrations'),
      ('crm_sync_runs', 'crm_integrations'),
      ('crm_field_mappings', 'crm_integrations'),
      ('crm_connection_audit', 'crm_integrations'),
      ('crm_record_links', 'crm_integrations'),
      ('crm_sync_record_failures', 'crm_integrations'),
      ('workspace_ai_providers', 'byok_ai'),
      ('workspace_agent_settings', 'ai_agent'),
      ('agent_conversations', 'ai_agent'),
      ('agent_messages', 'ai_agent'),
      ('agent_attachments', 'ai_agent'),
      ('agent_entity_refs', 'ai_agent'),
      ('agent_jobs', 'ai_agent'),
      ('agent_tool_calls', 'ai_agent'),
      ('agent_approvals', 'ai_agent'),
      ('agent_import_rows', 'ai_agent'),
      ('agent_idempotency_keys', 'ai_agent')
    ) as mapped(table_name, feature_name)
  loop
    policy_name := 'entitlement_restrict_' || entitlement.table_name;
    execute format('drop policy if exists %I on public.%I', policy_name, entitlement.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L)) with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L))',
      policy_name, entitlement.table_name, entitlement.feature_name, entitlement.feature_name
    );
  end loop;
end;
$$;

drop policy if exists entitlement_restrict_activities on public.activities;
create policy entitlement_restrict_activities on public.activities
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or (
      (public.workspace_feature_enabled(workspace_id, 'companies')
        or public.workspace_feature_enabled(workspace_id, 'contacts')
        or public.workspace_feature_enabled(workspace_id, 'leads')
        or public.workspace_feature_enabled(workspace_id, 'deals')
        or public.workspace_feature_enabled(workspace_id, 'tasks')
        or public.workspace_feature_enabled(workspace_id, 'quotes'))
      and
      (company_id is null or public.workspace_feature_enabled(workspace_id, 'companies'))
      and (contact_id is null or public.workspace_feature_enabled(workspace_id, 'contacts'))
      and (deal_id is null or public.workspace_feature_enabled(workspace_id, 'deals'))
      and (lead_id is null or public.workspace_feature_enabled(workspace_id, 'leads'))
      and (quote_id is null or public.workspace_feature_enabled(workspace_id, 'quotes'))
      and (task_id is null or public.workspace_feature_enabled(workspace_id, 'tasks'))
    )
  )
  with check (
    public.is_platform_admin()
    or (
      (public.workspace_feature_enabled(workspace_id, 'companies')
        or public.workspace_feature_enabled(workspace_id, 'contacts')
        or public.workspace_feature_enabled(workspace_id, 'leads')
        or public.workspace_feature_enabled(workspace_id, 'deals')
        or public.workspace_feature_enabled(workspace_id, 'tasks')
        or public.workspace_feature_enabled(workspace_id, 'quotes'))
      and
      (company_id is null or public.workspace_feature_enabled(workspace_id, 'companies'))
      and (contact_id is null or public.workspace_feature_enabled(workspace_id, 'contacts'))
      and (deal_id is null or public.workspace_feature_enabled(workspace_id, 'deals'))
      and (lead_id is null or public.workspace_feature_enabled(workspace_id, 'leads'))
      and (quote_id is null or public.workspace_feature_enabled(workspace_id, 'quotes'))
      and (task_id is null or public.workspace_feature_enabled(workspace_id, 'tasks'))
    )
  );

-- Invites and additional memberships are also protected at the database
-- boundary. The first owner inserted during onboarding remains allowed.
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
      case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
        and jsonb_typeof(s.entitlement_snapshot -> 'features' -> 'team') = 'boolean'
        then (s.entitlement_snapshot -> 'features' ->> 'team')::boolean end,
      case when (p.is_free or (s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')))
        and jsonb_typeof(p.features -> 'team') = 'boolean' then (p.features ->> 'team')::boolean end,
      false
    ) and not w.locked and w.archived_at is null and w.plan_status in ('active', 'trialing', 'past_due')
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

revoke all on function public.workspace_team_enabled_internal(uuid) from public, anon, authenticated;

create or replace function public.guard_workspace_team_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_platform_admin() then return new; end if;
  if tg_table_name = 'workspace_members'
     and new.role = 'owner'
     and not exists (select 1 from public.workspace_members wm where wm.workspace_id = new.workspace_id) then
    return new;
  end if;
  if not public.workspace_team_enabled_internal(new.workspace_id) then
    raise exception using errcode = 'P0001', message = 'team_not_available';
  end if;
  return new;
end;
$$;

drop trigger if exists invites_guard_team on public.invites;
create trigger invites_guard_team before insert on public.invites
for each row execute function public.guard_workspace_team_rows();
drop trigger if exists workspace_members_guard_team on public.workspace_members;
create trigger workspace_members_guard_team before insert on public.workspace_members
for each row execute function public.guard_workspace_team_rows();

-- Scrape cancellation remains available after suspension so users can stop
-- external cost. Starting or re-queueing work is denied by the trigger.
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
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.workspace_feature_enabled(new.workspace_id, 'scraping') then
    if tg_op = 'UPDATE'
       and old.status in ('queued', 'running')
       and new.status = 'canceled'
       and (to_jsonb(new) - array['status', 'error_message', 'finished_at', 'apify_usage_usd', 'updated_at'])
         = (to_jsonb(old) - array['status', 'error_message', 'finished_at', 'apify_usage_usd', 'updated_at']) then
      return new;
    end if;
    raise exception using errcode = 'P0001', message = 'scraping_not_available';
  end if;
  if new.status not in ('queued', 'running', 'ingesting') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('queued', 'running', 'ingesting') then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 0));
  allowed_count := greatest(1, coalesce(public.workspace_quota_limit(new.workspace_id, 'concurrent_scrape_runs', 1), 1));
  select count(*) into active_count from public.lead_scrape_jobs j
  where j.workspace_id = new.workspace_id
    and j.status in ('queued', 'running', 'ingesting')
    and j.id is distinct from new.id;
  if active_count >= allowed_count then
    raise exception using errcode = 'P0001', message = 'scrape_concurrency_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists lead_scrape_jobs_enforce_concurrency on public.lead_scrape_jobs;
create trigger lead_scrape_jobs_enforce_concurrency
before insert or update on public.lead_scrape_jobs
for each row execute function public.enforce_scrape_concurrency();

-- Run metadata remains readable so an owner/admin can identify and cancel an
-- active external run after access is suspended. The trigger above restricts
-- that exception to a cancellation-only update.
drop policy if exists entitlement_scrape_jobs_select on public.lead_scrape_jobs;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array['lead_scrape_results', 'lead_scrape_people'] loop
    policy_name := 'entitlement_restrict_' || table_name;
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L)) with check (public.is_platform_admin() or public.workspace_feature_enabled(workspace_id, %L))',
      policy_name, table_name, 'scraping', 'scraping'
    );
  end loop;
end;
$$;

-- The database derives the quote limit itself; callers cannot pass -1 to
-- enlarge it. Other counters are operational meters and intentionally unlimited.
create or replace function public.consume_quota(
  p_workspace_id uuid,
  p_field text,
  p_amount integer,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_updated integer;
  v_limit integer;
begin
  if p_amount <= 0 then return true; end if;
  if p_field not in ('quotes_created', 'ai_briefs', 'maps_scrapes', 'maps_places', 'maps_people') then
    raise exception 'invalid usage field';
  end if;
  if auth.role() is distinct from 'service_role'
     and public.current_workspace_id() is distinct from p_workspace_id then
    raise exception 'forbidden';
  end if;

  v_limit := case when p_field = 'quotes_created'
    then public.workspace_quota_limit(p_workspace_id, 'quotes_per_month', 0)
    else -1 end;
  if v_limit is null then return false; end if;

  insert into public.usage_counters (workspace_id, period)
  values (p_workspace_id, v_period)
  on conflict (workspace_id, period) do nothing;
  perform 1 from public.usage_counters
  where workspace_id = p_workspace_id and period = v_period for update;
  update public.usage_counters set
    quotes_created = quotes_created + case when p_field = 'quotes_created' then p_amount else 0 end,
    ai_briefs = ai_briefs + case when p_field = 'ai_briefs' then p_amount else 0 end,
    maps_scrapes = maps_scrapes + case when p_field = 'maps_scrapes' then p_amount else 0 end,
    maps_places = maps_places + case when p_field = 'maps_places' then p_amount else 0 end,
    maps_people = maps_people + case when p_field = 'maps_people' then p_amount else 0 end
  where workspace_id = p_workspace_id and period = v_period
    and (v_limit < 0 or case p_field
      when 'quotes_created' then quotes_created
      when 'ai_briefs' then ai_briefs
      when 'maps_scrapes' then maps_scrapes
      when 'maps_places' then maps_places
      when 'maps_people' then maps_people
    end + p_amount <= v_limit);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.enforce_quote_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.consume_quota(new.workspace_id, 'quotes_created', 1, 0) then
    raise exception using errcode = 'P0001', message = 'quote_monthly_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_enforce_monthly_quota on public.quotes;
create trigger quotes_enforce_monthly_quota
after insert on public.quotes
for each row execute function public.enforce_quote_quota();

-- Branding fields are protected independently because workspace_settings also
-- contains basic company information available on every plan.
create or replace function public.guard_workspace_branding_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_platform_admin() then return new; end if;
  if not public.workspace_feature_enabled(new.workspace_id, 'custom_branding') then
    if tg_op = 'INSERT' then
      if coalesce(new.logo_path, '') not in ('', '/brand/logo.jpg') or new.accent_color <> '#2FF29E' then
        raise exception 'custom_branding_not_available';
      end if;
    elsif new.logo_path is distinct from old.logo_path
       or new.accent_color is distinct from old.accent_color then
      raise exception 'custom_branding_not_available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_settings_guard_branding on public.workspace_settings;
create trigger workspace_settings_guard_branding
before insert or update on public.workspace_settings
for each row execute function public.guard_workspace_branding_fields();
revoke delete on public.workspace_settings from authenticated;

drop policy if exists logos_entitlement_restrict on storage.objects;
drop policy if exists storage_entitlement_restrict on storage.objects;
create policy storage_entitlement_restrict on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id not in ('logos', 'knowledge-files', 'presentations', 'contracts', 'agent-attachments')
    or public.is_platform_admin()
    or case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_feature_enabled(
        ((storage.foldername(name))[1])::uuid,
        case bucket_id
          when 'logos' then 'custom_branding'
          when 'knowledge-files' then 'product_modules'
          when 'presentations' then 'quotes'
          when 'contracts' then 'contracts'
          when 'agent-attachments' then 'ai_agent'
        end
      )
      else false
    end
  )
  with check (
    bucket_id not in ('logos', 'knowledge-files', 'presentations', 'contracts', 'agent-attachments')
    or public.is_platform_admin()
    or case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_feature_enabled(
        ((storage.foldername(name))[1])::uuid,
        case bucket_id
          when 'logos' then 'custom_branding'
          when 'knowledge-files' then 'product_modules'
          when 'presentations' then 'quotes'
          when 'contracts' then 'contracts'
          when 'agent-attachments' then 'ai_agent'
        end
      )
      else false
    end
  );

-- Failed webhook deliveries may be claimed again. A short lease prevents two
-- workers from processing the same event concurrently.
alter table public.billing_webhook_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

create or replace function public.claim_billing_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  insert into public.billing_webhook_events (
    provider, external_event_id, event_type, payload,
    processing_started_at, attempt_count, processing_error
  ) values (
    p_provider, p_event_id, p_event_type, p_payload,
    now(), 1, null
  )
  on conflict (provider, external_event_id) do update set
    event_type = excluded.event_type,
    payload = excluded.payload,
    processing_started_at = now(),
    attempt_count = public.billing_webhook_events.attempt_count + 1,
    processing_error = null
  where public.billing_webhook_events.processed_at is null
    and (
      public.billing_webhook_events.processing_started_at is null
      or public.billing_webhook_events.processing_started_at < now() - interval '5 minutes'
    )
  returning id into claimed_id;
  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_billing_webhook_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_event(text, text, text, jsonb) to service_role;
