alter table public.workspace_members
  add column if not exists seat_priority_at timestamptz;

update public.workspace_members
set seat_priority_at = created_at
where seat_priority_at is null;

alter table public.workspace_members
  alter column seat_priority_at set default now(),
  alter column seat_priority_at set not null;

create or replace function public.workspace_seat_limit(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(wo.quotas ->> 'seats', '')::integer,
    case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
      then nullif(s.entitlement_snapshot -> 'quotas' ->> 'seats', '')::integer end,
    nullif(p.quotas ->> 'seats', '')::integer,
    1
  )
  from public.workspaces w
  join public.plans p on p.id = w.plan_id
  left join public.subscriptions s on s.workspace_id = w.id
  left join public.workspace_overrides wo on wo.workspace_id = w.id
  where w.id = p_workspace_id;
$$;

create or replace function public.has_workspace_seat(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select wm.user_id,
      row_number() over (
        order by case when wm.role = 'owner' then 0 else 1 end,
                 wm.seat_priority_at asc,
                 wm.user_id asc
      ) as seat_rank
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
  ), seat_limit as (
    select public.workspace_seat_limit(p_workspace_id) as value
  )
  select exists (
    select 1 from ranked, seat_limit
    where ranked.user_id = p_user_id
      and (seat_limit.value < 0 or ranked.seat_rank <= seat_limit.value)
  );
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
    and public.has_workspace_seat(wm.workspace_id, wm.user_id)
  limit 1;
$$;

create or replace function public.create_workspace_invite(
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_membership public.workspace_members%rowtype;
  seat_limit integer;
  reserved_count integer;
  new_invite_id uuid;
begin
  select * into caller_membership
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
  if caller_membership.workspace_id is null or caller_membership.role not in ('owner', 'admin') then
    raise exception 'Not allowed to invite members';
  end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid member role'; end if;
  if nullif(trim(p_email), '') is null then raise exception 'Email is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_membership.workspace_id::text, 0));
  seat_limit := public.workspace_seat_limit(caller_membership.workspace_id);
  select count(*) into reserved_count from (
    select user_id::text as reservation from public.workspace_members
    where workspace_id = caller_membership.workspace_id
    union all
    select id::text from public.invites
    where workspace_id = caller_membership.workspace_id
      and accepted_at is null and expires_at > now()
  ) reservations;
  if seat_limit >= 0 and reserved_count >= seat_limit then
    raise exception 'SEAT_LIMIT_REACHED';
  end if;
  if exists (
    select 1 from public.invites where workspace_id = caller_membership.workspace_id
      and lower(email) = lower(trim(p_email)) and accepted_at is null and expires_at > now()
  ) then raise exception 'INVITE_ALREADY_PENDING'; end if;

  insert into public.invites (workspace_id, email, role, token_hash, invited_by, expires_at)
  values (caller_membership.workspace_id, lower(trim(p_email)), p_role, p_token_hash, auth.uid(), p_expires_at)
  returning id into new_invite_id;
  return new_invite_id;
end;
$$;

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
  where token_hash = p_token_hash and accepted_at is null and expires_at > now()
  limit 1;
  if target_invite.id is null then raise exception 'INVITE_INVALID'; end if;
  if lower(target_invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_invite.workspace_id::text, 0));
  if exists (select 1 from public.workspace_members where user_id = auth.uid())
     or exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'ACCOUNT_ALREADY_ASSIGNED';
  end if;

  seat_limit := public.workspace_seat_limit(target_invite.workspace_id);
  if seat_limit >= 0 then
    select count(*) into earlier_reservations from (
      select wm.user_id::text
      from public.workspace_members wm
      where wm.workspace_id = target_invite.workspace_id
        and (wm.role = 'owner' or wm.seat_priority_at <= target_invite.created_at)
      union all
      select i.id::text from public.invites i
      where i.workspace_id = target_invite.workspace_id
        and i.id <> target_invite.id
        and i.accepted_at is null and i.expires_at > now()
        and i.created_at < target_invite.created_at
    ) earlier;
    if earlier_reservations >= seat_limit then raise exception 'SEAT_LIMIT_REACHED'; end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, seat_priority_at)
  values (target_invite.workspace_id, auth.uid(), target_invite.role, target_invite.created_at);
  update public.invites set accepted_at = now() where id = target_invite.id;
  return target_invite.workspace_id;
end;
$$;

drop policy if exists members_insert_invite_accept on public.workspace_members;
drop policy if exists profiles_select_self_or_workspace on public.profiles;
create policy profiles_select_self_or_workspace on public.profiles
  for select using (
    id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1 from public.workspace_members them
      where them.workspace_id = public.current_workspace_id()
        and them.user_id = profiles.id
    )
  );
revoke insert on public.invites from authenticated;
revoke all on function public.workspace_seat_limit(uuid) from public, anon;
revoke all on function public.has_workspace_seat(uuid, uuid) from public, anon;
revoke all on function public.create_workspace_invite(text, text, text, timestamptz) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.workspace_seat_limit(uuid) to authenticated;
grant execute on function public.has_workspace_seat(uuid, uuid) to authenticated;
grant execute on function public.create_workspace_invite(text, text, text, timestamptz) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

create index if not exists workspace_members_seat_order_idx
  on public.workspace_members (workspace_id, seat_priority_at, user_id);
create index if not exists invites_open_seat_order_idx
  on public.invites (workspace_id, created_at)
  where accepted_at is null;
