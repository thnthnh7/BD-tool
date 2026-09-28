-- Approval queue for MCP write operations and rollout control.

alter table public.mcp_settings add column write_tools_enabled boolean not null default false;

create table public.mcp_action_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid references public.mcp_connections (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  action_type text not null check (action_type in ('create_company', 'start_maps_scrape')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed', 'failed')),
  result jsonb,
  error_message text,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mcp_action_requests_workspace_idx on public.mcp_action_requests (workspace_id, status, created_at desc);
create trigger mcp_action_requests_updated_at before update on public.mcp_action_requests for each row execute function public.set_updated_at();
alter table public.mcp_action_requests enable row level security;
revoke all on public.mcp_action_requests from anon, authenticated;
grant all on public.mcp_action_requests to service_role;
