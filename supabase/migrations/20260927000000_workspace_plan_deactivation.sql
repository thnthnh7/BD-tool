alter table public.workspaces
  add column if not exists plan_deactivated_at timestamptz,
  add column if not exists plan_deactivated_by uuid references public.profiles(id) on delete set null,
  add column if not exists plan_deactivation_reason text;

comment on column public.workspaces.plan_deactivated_at is
  'Platform-admin access lock. Provider subscriptions continue syncing, but cannot reactivate workspace entitlements while set.';

create index if not exists workspaces_plan_deactivated_idx
  on public.workspaces (plan_deactivated_at)
  where plan_deactivated_at is not null;
