create or replace function public.workspace_seat_limit(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when raw_limit < 0 then -1 else greatest(raw_limit, 1) end
  from (
    select coalesce(
      nullif(wo.quotas ->> 'seats', '')::integer,
      case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
        then nullif(s.entitlement_snapshot -> 'quotas' ->> 'seats', '')::integer end,
      nullif(p.quotas ->> 'seats', '')::integer,
      1
    ) as raw_limit
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides wo on wo.workspace_id = w.id
    where w.id = p_workspace_id
  ) effective_limit;
$$;

revoke all on function public.workspace_seat_limit(uuid) from public, anon;
grant execute on function public.workspace_seat_limit(uuid) to authenticated;
