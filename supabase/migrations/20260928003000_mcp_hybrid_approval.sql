-- Hybrid MCP writes: safe additive writes execute directly; paid actions use expiring approvals.

alter table public.mcp_action_requests
  add column expires_at timestamptz not null default (now() + interval '30 minutes'),
  add column idempotency_key text;

alter table public.mcp_action_requests drop constraint mcp_action_requests_status_check;
alter table public.mcp_action_requests add constraint mcp_action_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'completed', 'failed', 'expired'));

create unique index mcp_action_requests_idempotency_uidx
  on public.mcp_action_requests (connection_id, action_type, idempotency_key)
  where idempotency_key is not null;

create table public.mcp_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.mcp_connections (id) on delete cascade,
  tool_name text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (connection_id, tool_name, idempotency_key)
);

create index mcp_idempotency_workspace_idx on public.mcp_idempotency_keys (workspace_id, created_at desc);
alter table public.mcp_idempotency_keys enable row level security;
revoke all on public.mcp_idempotency_keys from anon, authenticated;
grant all on public.mcp_idempotency_keys to service_role;
