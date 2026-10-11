-- Agency foundation: one user can belong to multiple isolated workspaces and
-- explicitly select the workspace used by RLS helpers.
alter table public.profiles
  add column if not exists active_workspace_id uuid references public.workspaces (id) on delete set null;

drop index if exists public.workspace_members_user_id_uidx;

update public.profiles p
set active_workspace_id = (
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = p.id
  order by (wm.role = 'owner') desc, wm.created_at, wm.workspace_id
  limit 1
)
where p.active_workspace_id is null
  and exists (select 1 from public.workspace_members wm where wm.user_id = p.id);

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.user_id = auth.uid()
  order by (wm.workspace_id = p.active_workspace_id) desc,
           (wm.role = 'owner') desc,
           wm.created_at,
           wm.workspace_id
  limit 1;
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$;
  select wm.role
  from public.workspace_members wm
  where wm.user_id = auth.uid()
    and wm.workspace_id = public.current_workspace_id()
  limit 1;
$$;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
    or public.is_platform_admin()
  );

create or replace function public.create_agency_workspace(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  free_plan public.plans%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'workspace_name_required'; end if;
  if exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'platform_account_not_allowed';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ) then raise exception 'agency_workspace_forbidden'; end if;
  if (select count(*) from public.workspace_members where user_id = auth.uid()) >= 25 then
    raise exception 'workspace_limit_reached';
  end if;

  select * into free_plan from public.plans
  where is_public and is_free order by sort_order limit 1;
  if free_plan.id is null then raise exception 'free_plan_not_configured'; end if;

  insert into public.workspaces (id, type, name, slug, plan_id, plan_status)
  values (new_workspace_id, 'company', trim(p_name), p_slug, free_plan.id, 'active');
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');
  insert into public.subscriptions (workspace_id, plan_id, status, billing_interval, current_period_start, current_period_end)
  values (new_workspace_id, free_plan.id, 'active', 'monthly', now(), now() + interval '10 years');
  insert into public.workspace_settings (workspace_id, company_name, short_name, email)
  values (new_workspace_id, trim(p_name), trim(p_name), coalesce(auth.jwt() ->> 'email', ''));
  insert into public.modules (workspace_id, name, category, description, suggested_price, default_qty, visual_hint)
  select new_workspace_id, name, category, description, suggested_price, default_qty, visual_hint
  from public.module_templates order by sort_order;
  update public.profiles set active_workspace_id = new_workspace_id where id = auth.uid();
  return new_workspace_id;
end;
$$;

revoke all on function public.create_agency_workspace(text, text) from public, anon;
grant execute on function public.create_agency_workspace(text, text) to authenticated;

create or replace function public.list_my_workspaces()
returns table (id uuid, name text, type text, role text, provider_cost_usd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name, w.type, wm.role,
         coalesce(sum(greatest(coalesce(j.apify_usage_usd, 0), 0)), 0)::numeric as provider_cost_usd
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  left join public.lead_scrape_jobs j on j.workspace_id = w.id
  where wm.user_id = auth.uid() and w.archived_at is null
  group by w.id, w.name, w.type, wm.role
  order by w.name;
$$;

revoke all on function public.list_my_workspaces() from public, anon;
grant execute on function public.list_my_workspaces() to authenticated;

create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.invites%rowtype;
  seat_limit integer;
  earlier_reservations integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target_invite from public.invites
  where token_hash = p_token_hash and accepted_at is null and expires_at > now() limit 1;
  if target_invite.id is null then raise exception 'INVITE_INVALID'; end if;
  if lower(target_invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  if exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'ACCOUNT_ALREADY_ASSIGNED'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = target_invite.workspace_id and user_id = auth.uid()) then
    raise exception 'ACCOUNT_ALREADY_ASSIGNED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_invite.workspace_id::text, 0));
  seat_limit := public.workspace_seat_limit(target_invite.workspace_id);
  if seat_limit >= 0 then
    select count(*) into earlier_reservations from (
      select wm.user_id::text from public.workspace_members wm
      where wm.workspace_id = target_invite.workspace_id and (wm.role = 'owner' or wm.seat_priority_at <= target_invite.created_at)
      union all
      select i.id::text from public.invites i
      where i.workspace_id = target_invite.workspace_id and i.id <> target_invite.id
        and i.accepted_at is null and i.expires_at > now() and i.created_at < target_invite.created_at
    ) earlier;
    if earlier_reservations >= seat_limit then raise exception 'SEAT_LIMIT_REACHED'; end if;
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, seat_priority_at)
  values (target_invite.workspace_id, auth.uid(), target_invite.role, target_invite.created_at);
  update public.profiles set active_workspace_id = target_invite.workspace_id where id = auth.uid();
  update public.invites set accepted_at = now() where id = target_invite.id;
  return target_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;
