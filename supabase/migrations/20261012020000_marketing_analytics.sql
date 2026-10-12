create table if not exists public.marketing_sessions (
  id text primary key,
  visitor_id text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  landing_path text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  country_code text,
  device_type text not null default 'unknown',
  browser text not null default 'unknown',
  page_view_count integer not null default 0 check (page_view_count >= 0),
  engagement_ms bigint not null default 0 check (engagement_ms >= 0),
  max_scroll_depth integer not null default 0 check (max_scroll_depth between 0 and 100),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.marketing_sessions(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  event_name text not null check (event_name in ('page_view', 'engagement', 'scroll_depth', 'cta_click', 'signup_started', 'workspace_created', 'paid_activated')),
  path text,
  label text,
  engagement_ms integer check (engagement_ms is null or engagement_ms between 0 and 1800000),
  scroll_depth integer check (scroll_depth is null or scroll_depth between 0 and 100),
  dedupe_key text unique,
  occurred_at timestamptz not null default now()
);

create index if not exists marketing_sessions_started_at_idx on public.marketing_sessions(started_at desc);
create index if not exists marketing_sessions_visitor_id_idx on public.marketing_sessions(visitor_id);
create index if not exists marketing_sessions_workspace_id_idx on public.marketing_sessions(workspace_id);
create index if not exists marketing_sessions_source_idx on public.marketing_sessions(utm_source, utm_medium);
create index if not exists marketing_events_occurred_at_idx on public.marketing_events(occurred_at desc);
create index if not exists marketing_events_name_idx on public.marketing_events(event_name, occurred_at desc);
create index if not exists marketing_events_session_id_idx on public.marketing_events(session_id);

alter table public.marketing_sessions enable row level security;
alter table public.marketing_events enable row level security;

revoke all on public.marketing_sessions from anon, authenticated;
revoke all on public.marketing_events from anon, authenticated;
grant all on public.marketing_sessions to service_role;
grant all on public.marketing_events to service_role;

comment on table public.marketing_sessions is 'Consent-based, privacy-minimized public website sessions. Identifiers are HMAC hashed before storage.';
comment on table public.marketing_events is 'Public website interaction and server-verified conversion events. No raw IP, URL query, user agent, prompt, token, or workspace content.';
