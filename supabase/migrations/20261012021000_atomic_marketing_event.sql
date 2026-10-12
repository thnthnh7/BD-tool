create or replace function public.record_marketing_event(
  p_session_id text,
  p_visitor_id text,
  p_event_name text,
  p_path text,
  p_label text default null,
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_country_code text default null,
  p_device_type text default 'unknown',
  p_browser text default 'unknown',
  p_engagement_ms integer default null,
  p_scroll_depth integer default null,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_name not in ('page_view', 'engagement', 'scroll_depth', 'cta_click', 'signup_started') then
    raise exception 'unsupported marketing event';
  end if;

  insert into public.marketing_sessions (
    id, visitor_id, landing_path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    country_code, device_type, browser, page_view_count, engagement_ms, max_scroll_depth, started_at, last_seen_at
  ) values (
    p_session_id, p_visitor_id, p_path, p_referrer_host, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_country_code, p_device_type, p_browser,
    case when p_event_name = 'page_view' then 1 else 0 end,
    case when p_event_name = 'engagement' then coalesce(p_engagement_ms, 0) else 0 end,
    coalesce(p_scroll_depth, 0), p_occurred_at, p_occurred_at
  )
  on conflict (id) do update set
    last_seen_at = greatest(marketing_sessions.last_seen_at, excluded.last_seen_at),
    page_view_count = marketing_sessions.page_view_count + excluded.page_view_count,
    engagement_ms = marketing_sessions.engagement_ms + excluded.engagement_ms,
    max_scroll_depth = greatest(marketing_sessions.max_scroll_depth, excluded.max_scroll_depth);

  insert into public.marketing_events (session_id, event_name, path, label, engagement_ms, scroll_depth, occurred_at)
  values (p_session_id, p_event_name, p_path, p_label, p_engagement_ms, p_scroll_depth, p_occurred_at);
end;
$$;

revoke all on function public.record_marketing_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.record_marketing_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, timestamptz) to service_role;
