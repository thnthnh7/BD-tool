-- Shared Google/Microsoft engagement accounts, provider sync state and a
-- durable sequence job queue. Provider credentials stay in environment
-- variables; user OAuth tokens live in Supabase Vault.

create table public.engagement_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_user_id uuid references public.profiles (id) on delete set null,
  provider text not null check (provider in ('google', 'microsoft')),
  provider_account_id text not null,
  account_email text not null default '',
  display_name text not null default '',
  status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  capabilities text[] not null default array['mail', 'calendar']::text[],
  granted_scopes text[] not null default '{}'::text[],
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  authorized_at timestamptz,
  revoked_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_account_id)
);

create index engagement_accounts_workspace_idx on public.engagement_accounts (workspace_id, status, updated_at desc);
create trigger engagement_accounts_updated_at before update on public.engagement_accounts
for each row execute function public.set_updated_at();

create table public.engagement_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null references public.engagement_accounts (id) on delete cascade,
  resource text not null check (resource in ('mail', 'calendar')),
  provider_subscription_id text,
  provider_resource_id text,
  sync_cursor text,
  client_state_hash text,
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'expired')),
  expires_at timestamptz,
  last_notification_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, resource)
);

create index engagement_subscriptions_expiry_idx on public.engagement_subscriptions (status, expires_at);
create trigger engagement_subscriptions_updated_at before update on public.engagement_subscriptions
for each row execute function public.set_updated_at();

create table public.engagement_account_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid references public.engagement_accounts (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index engagement_account_audit_workspace_idx on public.engagement_account_audit (workspace_id, created_at desc);

create table public.engagement_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  account_id uuid references public.engagement_accounts (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.engagement_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table public.communications
  add column if not exists engagement_account_id uuid references public.engagement_accounts (id) on delete set null,
  add column if not exists provider_message_id text,
  add column if not exists provider_thread_id text,
  add column if not exists internet_message_id text,
  add column if not exists in_reply_to text,
  add column if not exists cc_addresses jsonb not null default '[]'::jsonb,
  add column if not exists bcc_addresses jsonb not null default '[]'::jsonb,
  add column if not exists snippet text not null default '',
  add column if not exists delivery_status text not null default 'logged'
    check (delivery_status in ('logged', 'queued', 'sent', 'delivered', 'failed', 'received')),
  add column if not exists synced_at timestamptz;

alter table public.communications drop constraint if exists communications_provider_check;
alter table public.communications add constraint communications_provider_check
  check (provider in ('manual', 'gmail', 'outlook', 'google', 'microsoft'));

create unique index if not exists communications_provider_message_uidx
  on public.communications (engagement_account_id, provider_message_id);

alter table public.meetings
  add column if not exists engagement_account_id uuid references public.engagement_accounts (id) on delete set null,
  add column if not exists provider_event_id text,
  add column if not exists calendar_id text,
  add column if not exists provider_etag text,
  add column if not exists timezone text not null default 'Asia/Ho_Chi_Minh',
  add column if not exists attendees jsonb not null default '[]'::jsonb,
  add column if not exists conference_url text,
  add column if not exists sync_status text not null default 'local'
    check (sync_status in ('local', 'pending', 'synced', 'error')),
  add column if not exists provider_updated_at timestamptz,
  add column if not exists deleted_at timestamptz;

create unique index if not exists meetings_provider_event_uidx
  on public.meetings (engagement_account_id, provider_event_id);

alter table public.sequences
  add column if not exists sender_account_id uuid references public.engagement_accounts (id) on delete set null,
  add column if not exists timezone text not null default 'Asia/Ho_Chi_Minh',
  add column if not exists sending_window jsonb not null default '{"days":[1,2,3,4,5],"start":"09:00","end":"17:00"}'::jsonb,
  add column if not exists daily_send_limit integer not null default 50 check (daily_send_limit between 1 and 500),
  add column if not exists stop_on_reply boolean not null default true;

alter table public.sequence_steps
  add column if not exists delay_minutes integer not null default 0 check (delay_minutes >= 0);

alter table public.sequence_enrollments
  add column if not exists contact_email text,
  add column if not exists paused_reason text,
  add column if not exists last_error text,
  add column if not exists completed_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create trigger sequence_enrollments_updated_at before update on public.sequence_enrollments
for each row execute function public.set_updated_at();

create table public.engagement_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sequence_id uuid references public.sequences (id) on delete cascade,
  enrollment_id uuid references public.sequence_enrollments (id) on delete cascade,
  step_id uuid references public.sequence_steps (id) on delete cascade,
  account_id uuid references public.engagement_accounts (id) on delete set null,
  job_type text not null check (job_type in ('email', 'task', 'wait', 'sync_mail', 'sync_calendar', 'renew_subscription')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'canceled')),
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index engagement_jobs_due_idx on public.engagement_jobs (status, available_at) where status in ('queued', 'failed');
create trigger engagement_jobs_updated_at before update on public.engagement_jobs
for each row execute function public.set_updated_at();

alter table public.engagement_accounts enable row level security;
alter table public.engagement_subscriptions enable row level security;
alter table public.engagement_account_audit enable row level security;
alter table public.engagement_webhook_events enable row level security;
alter table public.engagement_suppressions enable row level security;
alter table public.engagement_jobs enable row level security;

create policy engagement_accounts_workspace_read on public.engagement_accounts
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());
create policy engagement_subscriptions_workspace_read on public.engagement_subscriptions
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());
create policy engagement_account_audit_workspace_read on public.engagement_account_audit
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());
create policy engagement_suppressions_workspace_read on public.engagement_suppressions
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());
create policy engagement_jobs_workspace_read on public.engagement_jobs
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

create or replace function public.store_engagement_account_tokens(
  p_account_id uuid,
  p_access_token text,
  p_refresh_token text default null,
  p_expires_at timestamptz default null,
  p_scopes text[] default '{}'::text[],
  p_actor_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_account public.engagement_accounts%rowtype;
  v_access_id uuid;
  v_refresh_id uuid;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_account from public.engagement_accounts where id = p_account_id for update;
  if not found then raise exception 'Engagement account not found'; end if;
  v_access_id := v_account.access_token_secret_id;
  v_refresh_id := v_account.refresh_token_secret_id;
  if v_access_id is null then
    select vault.create_secret(p_access_token, 'engagement_' || p_account_id || '_access', 'Engagement OAuth access token') into v_access_id;
  else
    perform vault.update_secret(v_access_id, p_access_token);
  end if;
  if nullif(p_refresh_token, '') is not null then
    if v_refresh_id is null then
      select vault.create_secret(p_refresh_token, 'engagement_' || p_account_id || '_refresh', 'Engagement OAuth refresh token') into v_refresh_id;
    else
      perform vault.update_secret(v_refresh_id, p_refresh_token);
    end if;
  end if;
  update public.engagement_accounts set
    access_token_secret_id = v_access_id,
    refresh_token_secret_id = v_refresh_id,
    token_expires_at = p_expires_at,
    granted_scopes = coalesce(p_scopes, '{}'::text[]),
    authorized_at = coalesce(authorized_at, now()),
    revoked_at = null,
    status = 'connected',
    last_error = null
  where id = p_account_id;
  insert into public.engagement_account_audit (workspace_id, account_id, actor_user_id, action)
  values (v_account.workspace_id, p_account_id, p_actor_user_id, 'authorized');
end;
$$;

create or replace function public.get_engagement_account_tokens(p_account_id uuid)
returns table (access_token text, refresh_token text, token_expires_at timestamptz)
language sql
stable
security definer
set search_path = public, vault
as $$
  select access_secret.secret, refresh_secret.secret, a.token_expires_at
  from public.engagement_accounts a
  left join vault.decrypted_secrets access_secret on access_secret.id = a.access_token_secret_id
  left join vault.decrypted_secrets refresh_secret on refresh_secret.id = a.refresh_token_secret_id
  where a.id = p_account_id and (auth.jwt() ->> 'role') = 'service_role';
$$;

create or replace function public.revoke_engagement_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_account public.engagement_accounts%rowtype;
begin
  if auth.uid() is null or public.current_member_role() not in ('owner', 'admin') then
    raise exception 'Owner or admin role required';
  end if;
  select * into v_account from public.engagement_accounts where id = p_account_id for update;
  if not found or v_account.workspace_id is distinct from public.current_workspace_id() then
    raise exception 'Engagement account not found';
  end if;
  if v_account.access_token_secret_id is not null then delete from vault.secrets where id = v_account.access_token_secret_id; end if;
  if v_account.refresh_token_secret_id is not null then delete from vault.secrets where id = v_account.refresh_token_secret_id; end if;
  update public.engagement_accounts set
    access_token_secret_id = null,
    refresh_token_secret_id = null,
    token_expires_at = null,
    status = 'revoked',
    revoked_at = now()
  where id = p_account_id;
  update public.engagement_subscriptions set status = 'expired' where account_id = p_account_id;
  insert into public.engagement_account_audit (workspace_id, account_id, actor_user_id, action)
  values (v_account.workspace_id, p_account_id, auth.uid(), 'disconnected');
end;
$$;

create or replace function public.claim_engagement_jobs(p_limit integer default 20)
returns setof public.engagement_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  update public.engagement_jobs j set
    status = 'running',
    locked_at = now(),
    attempt_count = j.attempt_count + 1
  where j.id in (
    select q.id
    from public.engagement_jobs q
    where q.status in ('queued', 'failed')
      and q.available_at <= now()
      and q.attempt_count < q.max_attempts
      and (q.locked_at is null or q.locked_at < now() - interval '10 minutes')
    order by q.available_at, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  returning j.*;
end;
$$;

revoke all on function public.store_engagement_account_tokens(uuid, text, text, timestamptz, text[], uuid) from public, anon, authenticated;
revoke all on function public.get_engagement_account_tokens(uuid) from public, anon, authenticated;
revoke all on function public.claim_engagement_jobs(integer) from public, anon, authenticated;
grant execute on function public.store_engagement_account_tokens(uuid, text, text, timestamptz, text[], uuid) to service_role;
grant execute on function public.get_engagement_account_tokens(uuid) to service_role;
grant execute on function public.claim_engagement_jobs(integer) to service_role;
revoke all on function public.revoke_engagement_account(uuid) from public, anon;
grant execute on function public.revoke_engagement_account(uuid) to authenticated;
