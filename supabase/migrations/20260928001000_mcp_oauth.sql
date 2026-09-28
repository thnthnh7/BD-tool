-- OAuth 2.1 authorization-code + PKCE support for remote MCP clients.

create table public.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null check (char_length(client_name) between 1 and 120),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  response_types text[] not null default array['code'],
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method = 'none'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.mcp_oauth_codes (
  code_hash text primary key check (char_length(code_hash) = 64),
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  connection_id uuid not null references public.mcp_connections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  redirect_uri text not null,
  scopes text[] not null default '{}',
  code_challenge text not null,
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique check (char_length(access_token_hash) = 64),
  refresh_token_hash text unique check (refresh_token_hash is null or char_length(refresh_token_hash) = 64),
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  connection_id uuid not null references public.mcp_connections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  scopes text[] not null default '{}',
  resource text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index mcp_oauth_codes_expiry_idx on public.mcp_oauth_codes (expires_at) where used_at is null;
create index mcp_oauth_tokens_access_idx on public.mcp_oauth_tokens (access_token_hash) where revoked_at is null;
create index mcp_oauth_tokens_refresh_idx on public.mcp_oauth_tokens (refresh_token_hash) where revoked_at is null;

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;

revoke all on public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens from anon, authenticated;
grant all on public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens to service_role;
