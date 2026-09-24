-- Platform operations: account status, audit, flags, overrides, archive.

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists suspend_source text;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'suspended', 'deleted'));

alter table public.profiles drop constraint if exists profiles_suspend_source_check;
alter table public.profiles
  add constraint profiles_suspend_source_check
  check (suspend_source is null or suspend_source in ('admin', 'archive'));

alter table public.workspaces
  add column if not exists archived_at timestamptz;

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx on public.platform_audit_log (created_at desc);

create table if not exists public.platform_flags (
  id smallint primary key check (id = 1),
  signup_enabled boolean not null default true,
  ai_enabled boolean not null default true,
  scrape_enabled boolean not null default true,
  share_enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_flags (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.integration_heartbeats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('billing_cron', 'sepay_webhook', 'apify_webhook')),
  ok boolean not null,
  detail text not null default '',
  ran_at timestamptz not null default now()
);

create index if not exists integration_heartbeats_kind_ran_idx
  on public.integration_heartbeats (kind, ran_at desc);

create table if not exists public.workspace_overrides (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  quotas jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_notes_workspace_idx on public.workspace_notes (workspace_id, created_at desc);

create table if not exists public.invoice_archive (
  id uuid primary key default gen_random_uuid(),
  source_invoice_id uuid not null,
  workspace_id uuid not null,
  workspace_name text not null,
  plan_id uuid,
  payment_code text not null,
  amount integer not null,
  currency text not null,
  billing_interval text not null,
  status text not null,
  vat_requested boolean not null default false,
  vat_tax_code text not null default '',
  paid_at timestamptz,
  payments jsonb not null default '[]'::jsonb,
  invoice_created_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create or replace function public.prevent_last_super_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role is distinct from 'super_admin') then
    if (
      select count(*)
      from public.platform_admins
      where role = 'super_admin' and user_id <> old.user_id
    ) = 0 then
      raise exception 'Cannot remove the last super admin';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_admins_keep_last_super on public.platform_admins;
create trigger platform_admins_keep_last_super
before update or delete on public.platform_admins
for each row execute function public.prevent_last_super_admin();

create or replace function public.record_platform_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not a platform admin';
  end if;
  insert into public.platform_audit_log (actor_user_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_before, '{}'::jsonb),
    coalesce(p_after, '{}'::jsonb)
  );
end;
$$;

create or replace function public.platform_workspace_counts(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not a platform admin';
  end if;
  return jsonb_build_object(
    'companies', (select count(*) from public.companies where workspace_id = p_workspace_id),
    'contacts', (select count(*) from public.contacts where workspace_id = p_workspace_id),
    'leads', (select count(*) from public.leads where workspace_id = p_workspace_id),
    'deals', (select count(*) from public.deals where workspace_id = p_workspace_id),
    'quotes', (select count(*) from public.quotes where workspace_id = p_workspace_id)
  );
end;
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if public.platform_role() = 'super_admin' then
    null;
  elsif public.current_workspace_id() = p_workspace_id
        and public.current_member_role() in ('owner', 'admin') then
    null;
  else
    raise exception 'Not allowed';
  end if;

  select role into target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if target_role is null then
    raise exception 'Member not found';
  end if;
  if target_role = 'owner' then
    raise exception 'Transfer ownership before removing the owner';
  end if;
  if p_user_id = auth.uid() and public.platform_role() is distinct from 'super_admin' then
    raise exception 'Cannot remove yourself';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

create or replace function public.transfer_workspace_owner(p_workspace_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.platform_role() = 'super_admin' then
    null;
  elsif public.current_workspace_id() = p_workspace_id
        and public.current_member_role() = 'owner' then
    null;
  else
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_new_owner
  ) then
    raise exception 'New owner must already be a member';
  end if;

  update public.workspace_members
  set role = 'admin'
  where workspace_id = p_workspace_id and role = 'owner';

  update public.workspace_members
  set role = 'owner'
  where workspace_id = p_workspace_id and user_id = p_new_owner;
end;
$$;

create or replace function public.set_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  if public.platform_role() = 'super_admin' then
    null;
  elsif public.current_workspace_id() = p_workspace_id
        and public.current_member_role() = 'owner' then
    null;
  else
    raise exception 'Not allowed';
  end if;

  select role into target_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if target_role is null then
    raise exception 'Member not found';
  end if;
  if target_role = 'owner' then
    raise exception 'Transfer ownership instead of changing the owner role';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

revoke all on function public.record_platform_audit(text, text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.platform_workspace_counts(uuid) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.transfer_workspace_owner(uuid, uuid) from public, anon;
revoke all on function public.set_workspace_member_role(uuid, uuid, text) from public, anon;

grant execute on function public.record_platform_audit(text, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.platform_workspace_counts(uuid) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_workspace_owner(uuid, uuid) to authenticated;
grant execute on function public.set_workspace_member_role(uuid, uuid, text) to authenticated;

alter table public.platform_audit_log enable row level security;
alter table public.platform_flags enable row level security;
alter table public.integration_heartbeats enable row level security;
alter table public.workspace_overrides enable row level security;
alter table public.workspace_notes enable row level security;
alter table public.invoice_archive enable row level security;

create policy platform_audit_select on public.platform_audit_log
  for select using (public.is_platform_admin());

create policy platform_flags_select on public.platform_flags
  for select using (true);

create policy platform_flags_update_super on public.platform_flags
  for update using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy integration_heartbeats_select on public.integration_heartbeats
  for select using (public.is_platform_admin());

create policy workspace_overrides_select on public.workspace_overrides
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy workspace_overrides_write_super on public.workspace_overrides
  for all using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy workspace_notes_select on public.workspace_notes
  for select using (public.is_platform_admin());

create policy workspace_notes_insert on public.workspace_notes
  for insert with check (public.is_platform_admin());

create policy invoice_archive_select on public.invoice_archive
  for select using (public.platform_role() = 'super_admin');

drop policy if exists workspaces_update_platform on public.workspaces;
create policy workspaces_update_platform on public.workspaces
  for update using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

drop policy if exists invoices_update_owner_or_platform on public.invoices;
create policy invoices_update_owner_or_super on public.invoices
  for update using (
    (workspace_id = public.current_workspace_id() and public.current_member_role() = 'owner')
    or public.platform_role() = 'super_admin'
  )
  with check (
    (workspace_id = public.current_workspace_id() and public.current_member_role() = 'owner')
    or public.platform_role() = 'super_admin'
  );

create policy invites_delete_super on public.invites
  for delete using (public.platform_role() = 'super_admin');

create policy platform_admins_update_super on public.platform_admins
  for update using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy platform_admins_delete_super on public.platform_admins
  for delete using (public.platform_role() = 'super_admin');

create policy public_quotes_delete_super on public.public_quotes
  for delete using (public.platform_role() = 'super_admin');

create policy lead_scrape_jobs_platform_select on public.lead_scrape_jobs
  for select using (public.is_platform_admin());

create policy workspace_ai_providers_platform_select on public.workspace_ai_providers
  for select using (public.is_platform_admin());
