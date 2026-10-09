alter table public.public_quotes
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists revoked_at timestamptz;

create index if not exists public_quotes_active_idx
  on public.public_quotes (id, expires_at)
  where revoked_at is null;

-- Secret ciphertext must only be read through trusted server code using service_role.
revoke select on table public.workspace_ai_providers from authenticated;
revoke select on table public.billing_provider_configs from authenticated;

-- Legacy personal access tokens without an expiry are no longer accepted.
update public.mcp_connections
set status = 'revoked', updated_at = now()
where status = 'active' and expires_at is null;
