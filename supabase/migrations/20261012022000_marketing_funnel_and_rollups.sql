alter table public.marketing_events drop constraint if exists marketing_events_event_name_check;
alter table public.marketing_events add constraint marketing_events_event_name_check check (event_name in (
  'page_view', 'engagement', 'scroll_depth', 'cta_click', 'pricing_viewed', 'plan_selected', 'signup_started',
  'workspace_created', 'checkout_started', 'checkout_failed', 'paid_activated', 'source_installed',
  'first_scrape_succeeded', 'first_crm_import'
));

create table if not exists public.marketing_daily_metrics (
  metric_date date primary key,
  visitors integer not null default 0,
  sessions integer not null default 0,
  pageviews integer not null default 0,
  engagement_ms bigint not null default 0,
  engaged_sessions integer not null default 0,
  signup_started integer not null default 0,
  workspaces_created integer not null default 0,
  checkout_started integer not null default 0,
  checkout_failed integer not null default 0,
  paid_activated integer not null default 0,
  sources_installed integer not null default 0,
  first_scrapes integer not null default 0,
  first_crm_imports integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.marketing_daily_metrics enable row level security;
revoke all on public.marketing_daily_metrics from anon, authenticated;
grant all on public.marketing_daily_metrics to service_role;

create or replace function public.refresh_marketing_daily_metrics(p_from date default current_date - 3, p_to date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.marketing_daily_metrics (
    metric_date, visitors, sessions, pageviews, engagement_ms, engaged_sessions, signup_started,
    workspaces_created, checkout_started, checkout_failed, paid_activated, sources_installed,
    first_scrapes, first_crm_imports, updated_at
  )
  select day::date,
    (select count(distinct visitor_id) from public.marketing_sessions where started_at >= day and started_at < day + interval '1 day'),
    (select count(*) from public.marketing_sessions where started_at >= day and started_at < day + interval '1 day'),
    (select coalesce(sum(page_view_count), 0) from public.marketing_sessions where started_at >= day and started_at < day + interval '1 day'),
    (select coalesce(sum(engagement_ms), 0) from public.marketing_sessions where started_at >= day and started_at < day + interval '1 day'),
    (select count(*) from public.marketing_sessions where started_at >= day and started_at < day + interval '1 day' and (engagement_ms >= 10000 or page_view_count >= 2)),
    (select count(distinct session_id) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'signup_started'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'workspace_created'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'checkout_started'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'checkout_failed'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'paid_activated'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'source_installed'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'first_scrape_succeeded'),
    (select count(*) from public.marketing_events where occurred_at >= day and occurred_at < day + interval '1 day' and event_name = 'first_crm_import'),
    now()
  from generate_series(p_from::timestamptz, p_to::timestamptz, interval '1 day') day
  on conflict (metric_date) do update set
    visitors = excluded.visitors, sessions = excluded.sessions, pageviews = excluded.pageviews,
    engagement_ms = excluded.engagement_ms, engaged_sessions = excluded.engaged_sessions,
    signup_started = excluded.signup_started, workspaces_created = excluded.workspaces_created,
    checkout_started = excluded.checkout_started, checkout_failed = excluded.checkout_failed,
    paid_activated = excluded.paid_activated, sources_installed = excluded.sources_installed,
    first_scrapes = excluded.first_scrapes, first_crm_imports = excluded.first_crm_imports, updated_at = now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.refresh_marketing_daily_metrics(date, date) from public, anon, authenticated;
grant execute on function public.refresh_marketing_daily_metrics(date, date) to service_role;

create or replace function public.record_marketing_event(
  p_session_id text, p_visitor_id text, p_event_name text, p_path text, p_label text default null,
  p_referrer_host text default null, p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null, p_utm_content text default null, p_utm_term text default null,
  p_country_code text default null, p_device_type text default 'unknown', p_browser text default 'unknown',
  p_engagement_ms integer default null, p_scroll_depth integer default null, p_occurred_at timestamptz default now()
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_name not in ('page_view', 'engagement', 'scroll_depth', 'cta_click', 'pricing_viewed', 'plan_selected', 'signup_started') then raise exception 'unsupported marketing event'; end if;
  if (select count(*) from public.marketing_events where session_id = p_session_id and occurred_at > p_occurred_at - interval '1 minute') >= 60 then return; end if;
  insert into public.marketing_sessions (id, visitor_id, landing_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, country_code, device_type, browser, page_view_count, engagement_ms, max_scroll_depth, started_at, last_seen_at)
  values (p_session_id, p_visitor_id, p_path, p_referrer_host, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_country_code, p_device_type, p_browser, case when p_event_name = 'page_view' then 1 else 0 end, case when p_event_name = 'engagement' then coalesce(p_engagement_ms, 0) else 0 end, coalesce(p_scroll_depth, 0), p_occurred_at, p_occurred_at)
  on conflict (id) do update set last_seen_at = greatest(marketing_sessions.last_seen_at, excluded.last_seen_at), page_view_count = marketing_sessions.page_view_count + excluded.page_view_count, engagement_ms = marketing_sessions.engagement_ms + excluded.engagement_ms, max_scroll_depth = greatest(marketing_sessions.max_scroll_depth, excluded.max_scroll_depth);
  insert into public.marketing_events (session_id, event_name, path, label, engagement_ms, scroll_depth, occurred_at) values (p_session_id, p_event_name, p_path, p_label, p_engagement_ms, p_scroll_depth, p_occurred_at);
end;
$$;

revoke all on function public.record_marketing_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.record_marketing_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, timestamptz) to service_role;
