-- Custom branding is a standard workspace capability and is no longer gated
-- by commercial plan configuration.

update public.plans
set features = jsonb_set(coalesce(features, '{}'::jsonb), '{custom_branding}', 'true'::jsonb, true),
    updated_at = now();

update public.subscriptions
set entitlement_snapshot = jsonb_set(
  coalesce(entitlement_snapshot, '{}'::jsonb),
  '{features}',
  coalesce(entitlement_snapshot -> 'features', '{}'::jsonb) || '{"custom_branding":true}'::jsonb,
  true
)
where entitlement_snapshot is not null;

update public.workspace_overrides
set features = coalesce(features, '{}'::jsonb) - 'custom_branding',
    updated_at = now()
where coalesce(features, '{}'::jsonb) ? 'custom_branding';

create or replace function public.workspace_feature_enabled(
  p_workspace_id uuid,
  p_feature text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.role() = 'service_role'
    or public.is_platform_admin()
    or public.has_workspace_seat(p_workspace_id, auth.uid())
  ) and coalesce((
    select (
      p_feature = 'custom_branding'
      or coalesce(
        case when jsonb_typeof(o.features -> p_feature) = 'boolean'
          then (o.features ->> p_feature)::boolean end,
        case when s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')
          and jsonb_typeof(s.entitlement_snapshot -> 'features' -> p_feature) = 'boolean'
          then (s.entitlement_snapshot -> 'features' ->> p_feature)::boolean end,
        case when (p.is_free or (s.plan_id = w.plan_id and s.status in ('active', 'trialing', 'past_due')))
          and jsonb_typeof(p.features -> p_feature) = 'boolean'
          then (p.features ->> p_feature)::boolean end,
        false
      )
    )
    and not w.locked
    and w.archived_at is null
    and w.plan_status in ('active', 'trialing', 'past_due')
    from public.workspaces w
    join public.plans p on p.id = w.plan_id
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.workspace_overrides o on o.workspace_id = w.id
    where w.id = p_workspace_id
  ), false);
$$;

revoke all on function public.workspace_feature_enabled(uuid, text) from public, anon;
grant execute on function public.workspace_feature_enabled(uuid, text) to authenticated, service_role;
