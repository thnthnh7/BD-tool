-- Provider-neutral billing for Stripe, PayPal and the existing SePay flow.
create table if not exists public.billing_provider_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paypal', 'sepay')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  currency text not null,
  amount integer not null check (amount >= 0),
  external_product_id text,
  external_price_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, provider, billing_interval)
);

create trigger billing_provider_prices_updated_at
before update on public.billing_provider_prices
for each row execute function public.set_updated_at();

alter table public.subscriptions
  add column if not exists provider text not null default 'sepay',
  add column if not exists external_customer_id text,
  add column if not exists external_subscription_id text,
  add column if not exists external_plan_id text,
  add column if not exists provider_status text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_end timestamptz;

create unique index if not exists subscriptions_provider_external_id_idx
  on public.subscriptions (provider, external_subscription_id)
  where external_subscription_id is not null;

alter table public.invoices
  add column if not exists provider text not null default 'sepay',
  add column if not exists external_invoice_id text,
  add column if not exists provider_status text,
  add column if not exists hosted_invoice_url text;

create unique index if not exists invoices_provider_external_id_idx
  on public.invoices (provider, external_invoice_id)
  where external_invoice_id is not null;

alter table public.payments
  alter column sepay_id drop not null,
  add column if not exists provider text not null default 'sepay',
  add column if not exists external_payment_id text,
  add column if not exists currency text not null default 'VND',
  add column if not exists provider_fee integer,
  add column if not exists net_amount integer,
  add column if not exists refund_status text;

create unique index if not exists payments_provider_external_id_idx
  on public.payments (provider, external_payment_id)
  where external_payment_id is not null;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'paypal', 'sepay')),
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, external_event_id)
);

create index if not exists billing_webhook_events_unprocessed_idx
  on public.billing_webhook_events (provider, received_at)
  where processed_at is null;

alter table public.billing_provider_prices enable row level security;
alter table public.billing_webhook_events enable row level security;

create policy billing_provider_prices_select on public.billing_provider_prices
  for select using (active or public.is_platform_admin());

create policy billing_provider_prices_platform_manage on public.billing_provider_prices
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Webhook events are service-role only. No authenticated-client policy is intentional.
