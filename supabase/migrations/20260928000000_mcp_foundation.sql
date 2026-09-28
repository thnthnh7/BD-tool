-- Remote MCP foundation: workspace-scoped access tokens and immutable tool audit.

create table public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (char_length(token_hash) = 64),
  token_prefix text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mcp_connections_workspace_idx on public.mcp_connections (workspace_id, created_at desc);
create index mcp_connections_active_token_idx on public.mcp_connections (token_hash) where status = 'active';

create trigger mcp_connections_updated_at
before update on public.mcp_connections
for each row execute function public.set_updated_at();

create table public.mcp_tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid references public.mcp_connections (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  request_id text,
  tool_name text not null,
  status text not null check (status in ('success', 'error')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  input_summary jsonb not null default '{}'::jsonb,
  result_count integer,
  error_code text,
  created_at timestamptz not null default now()
);

create index mcp_tool_calls_workspace_idx on public.mcp_tool_calls (workspace_id, created_at desc);
create index mcp_tool_calls_connection_idx on public.mcp_tool_calls (connection_id, created_at desc);

create table public.mcp_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  read_tools_enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.mcp_settings (id, enabled, read_tools_enabled) values (1, true, true);

alter table public.mcp_connections enable row level security;
alter table public.mcp_tool_calls enable row level security;
alter table public.mcp_settings enable row level security;

-- These tables contain access metadata and are intentionally server-only.
revoke all on public.mcp_connections from anon, authenticated;
revoke all on public.mcp_tool_calls from anon, authenticated;
revoke all on public.mcp_settings from anon, authenticated;

grant all on public.mcp_connections to service_role;
grant all on public.mcp_tool_calls to service_role;
grant all on public.mcp_settings to service_role;

