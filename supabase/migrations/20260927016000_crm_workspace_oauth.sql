alter table public.crm_connections
  add column if not exists access_token_secret_id uuid,
  add column if not exists refresh_token_secret_id uuid,
  add column if not exists token_expires_at timestamptz,
  add column if not exists granted_scopes text[] not null default '{}'::text[],
  add column if not exists authorized_by uuid references public.profiles (id) on delete set null,
  add column if not exists authorized_at timestamptz,
  add column if not exists revoked_at timestamptz;

create table if not exists public.crm_connection_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid references public.crm_connections (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_connection_audit_workspace_idx
  on public.crm_connection_audit (workspace_id, created_at desc);

alter table public.crm_connection_audit enable row level security;
create policy crm_connection_audit_workspace_read on public.crm_connection_audit
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

create or replace function public.store_crm_connection_tokens(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text default null,
  p_expires_at timestamptz default null,
  p_scopes text[] default '{}'::text[],
  p_actor_user_id uuid default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_connection public.crm_connections%rowtype;
  v_access_id uuid;
  v_refresh_id uuid;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_connection from public.crm_connections where id = p_connection_id for update;
  if not found then raise exception 'CRM connection not found'; end if;
  v_access_id := v_connection.access_token_secret_id;
  v_refresh_id := v_connection.refresh_token_secret_id;
  if v_access_id is null then
    select vault.create_secret(p_access_token, 'crm_connection_' || p_connection_id || '_access', 'CRM workspace access token') into v_access_id;
  else
    perform vault.update_secret(v_access_id, p_access_token);
  end if;
  if nullif(p_refresh_token, '') is not null then
    if v_refresh_id is null then
      select vault.create_secret(p_refresh_token, 'crm_connection_' || p_connection_id || '_refresh', 'CRM workspace refresh token') into v_refresh_id;
    else
      perform vault.update_secret(v_refresh_id, p_refresh_token);
    end if;
  end if;
  update public.crm_connections set
    access_token_secret_id = v_access_id,
    refresh_token_secret_id = v_refresh_id,
    token_expires_at = p_expires_at,
    granted_scopes = coalesce(p_scopes, '{}'::text[]),
    authorized_by = coalesce(p_actor_user_id, authorized_by),
    authorized_at = coalesce(authorized_at, now()),
    revoked_at = null,
    status = 'connected',
    setup_step = case when setup_step = 'authorization' then 'mapping' else setup_step end,
    last_error = null,
    metadata = metadata || coalesce(p_detail, '{}'::jsonb)
  where id = p_connection_id;
  insert into public.crm_connection_audit (workspace_id, connection_id, actor_user_id, action, detail)
  values (v_connection.workspace_id, p_connection_id, p_actor_user_id, coalesce(p_detail ->> 'event', 'authorized'), p_detail - 'event');
end;
$$;

create or replace function public.get_crm_connection_tokens(p_connection_id uuid)
returns table (access_token text, refresh_token text, token_expires_at timestamptz)
language sql
stable
security definer
set search_path = public, vault
as $$
  select access_secret.secret, refresh_secret.secret, c.token_expires_at
  from public.crm_connections c
  left join vault.decrypted_secrets access_secret on access_secret.id = c.access_token_secret_id
  left join vault.decrypted_secrets refresh_secret on refresh_secret.id = c.refresh_token_secret_id
  where c.id = p_connection_id and (auth.jwt() ->> 'role') = 'service_role';
$$;

revoke all on function public.store_crm_connection_tokens(uuid, text, text, timestamptz, text[], uuid, jsonb) from public, authenticated;
grant execute on function public.store_crm_connection_tokens(uuid, text, text, timestamptz, text[], uuid, jsonb) to service_role;
revoke all on function public.get_crm_connection_tokens(uuid) from public, authenticated;
grant execute on function public.get_crm_connection_tokens(uuid) to service_role;

create or replace function public.revoke_crm_connection(p_connection_id uuid, p_actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_connection public.crm_connections%rowtype;
begin
  select * into v_connection from public.crm_connections where id = p_connection_id for update;
  if not found or v_connection.workspace_id is distinct from public.current_workspace_id() then raise exception 'CRM connection not found'; end if;
  if v_connection.access_token_secret_id is not null then delete from vault.secrets where id = v_connection.access_token_secret_id; end if;
  if v_connection.refresh_token_secret_id is not null then delete from vault.secrets where id = v_connection.refresh_token_secret_id; end if;
  update public.crm_connections set access_token_secret_id = null, refresh_token_secret_id = null,
    token_expires_at = null, status = 'needs_authorization', setup_step = 'authorization', revoked_at = now()
  where id = p_connection_id;
  insert into public.crm_connection_audit (workspace_id, connection_id, actor_user_id, action)
  values (v_connection.workspace_id, p_connection_id, p_actor_user_id, 'disconnected');
end;
$$;

revoke all on function public.revoke_crm_connection(uuid, uuid) from public, anon;
grant execute on function public.revoke_crm_connection(uuid, uuid) to authenticated;
