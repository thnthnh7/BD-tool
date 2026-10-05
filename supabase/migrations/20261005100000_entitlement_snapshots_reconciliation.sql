alter table public.plans
  add column if not exists entitlement_version integer not null default 1
  check (entitlement_version > 0);

alter table public.subscriptions
  add column if not exists entitlement_version integer not null default 1,
  add column if not exists entitlement_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists reconciliation_error text;

update public.subscriptions s
set entitlement_version = p.entitlement_version,
    entitlement_snapshot = jsonb_build_object(
      'version', p.entitlement_version,
      'quotas', p.quotas,
      'features', p.features
    )
from public.plans p
where p.id = s.plan_id
  and (s.entitlement_snapshot = '{}'::jsonb or s.entitlement_snapshot is null);

create or replace function public.capture_subscription_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan public.plans%rowtype;
begin
  if new.entitlement_snapshot = '{}'::jsonb
     or new.entitlement_snapshot is null
     or (tg_op = 'UPDATE' and new.plan_id is distinct from old.plan_id)
     or (tg_op = 'UPDATE' and new.external_subscription_id is distinct from old.external_subscription_id)
  then
    select * into selected_plan from public.plans where id = new.plan_id;
    if found then
      new.entitlement_version := selected_plan.entitlement_version;
      new.entitlement_snapshot := jsonb_build_object(
        'version', selected_plan.entitlement_version,
        'quotas', selected_plan.quotas,
        'features', selected_plan.features
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_capture_entitlements on public.subscriptions;
create trigger subscriptions_capture_entitlements
before insert or update of plan_id, external_subscription_id, entitlement_snapshot
on public.subscriptions
for each row execute function public.capture_subscription_entitlements();

create index if not exists subscriptions_reconciliation_idx
  on public.subscriptions (last_reconciled_at asc nulls first)
  where provider in ('stripe', 'paypal') and external_subscription_id is not null;
