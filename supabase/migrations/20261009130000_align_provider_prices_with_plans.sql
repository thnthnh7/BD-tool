-- Plans are the canonical commercial price. Provider rows are executable
-- checkout artifacts and must never remain active at a stale amount.
update public.billing_provider_prices as price
set active = false,
    updated_at = now()
from public.plans as plan
where price.plan_id = plan.id
  and price.active = true
  and price.amount <> case
    when price.billing_interval = 'monthly' then plan.price_monthly
    when price.billing_interval = 'yearly' then plan.price_yearly
    else price.amount
  end;

insert into public.billing_provider_prices (
  plan_id, provider, billing_interval, currency, amount,
  external_product_id, external_price_id, active
)
select
  plan.id,
  'sepay',
  interval.value,
  'USD',
  case when interval.value = 'monthly' then plan.price_monthly else plan.price_yearly end,
  null,
  'sepay:' || plan.id::text || ':' || interval.value,
  true
from public.plans as plan
cross join (values ('monthly'), ('yearly')) as interval(value)
where plan.is_free = false
  and case when interval.value = 'monthly' then plan.price_monthly else plan.price_yearly end > 0
on conflict (plan_id, provider, billing_interval)
do update set
  amount = excluded.amount,
  currency = excluded.currency,
  external_product_id = excluded.external_product_id,
  external_price_id = excluded.external_price_id,
  active = true,
  updated_at = now();
