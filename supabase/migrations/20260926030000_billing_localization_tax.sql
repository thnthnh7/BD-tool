-- Persist the customer market and the provider-confirmed tax breakdown on each invoice.
alter table public.invoices
  add column if not exists billing_country text,
  add column if not exists display_currency text,
  add column if not exists subtotal_amount integer,
  add column if not exists tax_amount integer not null default 0,
  add column if not exists total_amount integer,
  add column if not exists tax_behavior text check (tax_behavior in ('inclusive', 'exclusive')),
  add column if not exists tax_calculation_id text;

update public.invoices
set subtotal_amount = coalesce(subtotal_amount, amount),
    total_amount = coalesce(total_amount, amount)
where subtotal_amount is null or total_amount is null;

