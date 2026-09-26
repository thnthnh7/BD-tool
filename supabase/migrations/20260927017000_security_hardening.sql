-- Prevent anonymous enumeration of public quote payloads. Public access is
-- mediated by the server route, which validates the opaque share id.
drop policy if exists public_quotes_select_by_id on public.public_quotes;
revoke select on table public.public_quotes from anon;

-- Invite acceptance must use the immutable email claim from Supabase Auth,
-- rather than the user-editable profiles.email column.
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists members_insert_invite_accept on public.workspace_members;
create policy members_insert_invite_accept on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    and role in ('admin', 'member')
    and exists (
      select 1
      from public.invites i
      where i.workspace_id = workspace_members.workspace_id
        and i.role = workspace_members.role
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and i.accepted_at is null
        and i.expires_at > now()
    )
  );

drop policy if exists platform_invites_select_own on public.platform_invites;
create policy platform_invites_select_own on public.platform_invites
  for select using (
    public.is_platform_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists platform_admins_insert_invite on public.platform_admins;
create policy platform_admins_insert_invite on public.platform_admins
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.platform_invites i
      where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and i.role = platform_admins.role
        and i.accepted_at is null
        and i.expires_at > now()
    )
  );

-- RLS limits rows, but it does not limit columns. Prevent workspace members
-- from changing subscription/lock fields through the public REST endpoint.
create or replace function public.guard_workspace_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_platform_admin() then
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id
    or new.plan_status is distinct from old.plan_status
    or new.locked is distinct from old.locked
    or new.archived_at is distinct from old.archived_at
    or new.plan_deactivated_at is distinct from old.plan_deactivated_at
    or new.plan_deactivated_by is distinct from old.plan_deactivated_by
    or new.plan_deactivation_reason is distinct from old.plan_deactivation_reason
    or new.plan_status_before_deactivation is distinct from old.plan_status_before_deactivation then
    raise exception 'Workspace billing and security fields can only be changed by the platform';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_workspace_security_fields on public.workspaces;
create trigger guard_workspace_security_fields
before update on public.workspaces
for each row execute function public.guard_workspace_security_fields();

-- Keep the profile email and account state synchronized from trusted server
-- code. A user may still edit their display name and locale.
create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_platform_admin() then
    return new;
  end if;
  if new.email is distinct from old.email
    or new.status is distinct from old.status
    or new.suspend_source is distinct from old.suspend_source
    or new.deleted_at is distinct from old.deleted_at then
    raise exception 'Profile identity and account state are server managed';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_security_fields on public.profiles;
create trigger guard_profile_security_fields
before update on public.profiles
for each row execute function public.guard_profile_security_fields();
