create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  operation text not null,
  source text not null check (source in ('byok', 'platform')),
  provider text not null,
  model text not null default '',
  status text not null check (status in ('success', 'error')),
  latency_ms integer not null default 0,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error_message text not null default '',
  created_at timestamptz not null default now()
);

create index ai_usage_events_workspace_created_idx
  on public.ai_usage_events (workspace_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy ai_usage_events_workspace_select on public.ai_usage_events
  for select using (
    (workspace_id = public.current_workspace_id() and public.current_member_role() in ('owner', 'admin'))
    or public.is_platform_admin()
  );

