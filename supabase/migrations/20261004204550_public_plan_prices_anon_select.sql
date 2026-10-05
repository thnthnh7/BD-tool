drop policy if exists billing_provider_prices_select on public.billing_provider_prices;
drop policy if exists billing_provider_prices_public_active on public.billing_provider_prices;
drop policy if exists billing_provider_prices_admin_select on public.billing_provider_prices;
drop policy if exists billing_provider_prices_platform_manage on public.billing_provider_prices;

create policy billing_provider_prices_public_active
  on public.billing_provider_prices
  for select
  to anon, authenticated
  using (active = true);

create policy billing_provider_prices_admin_select
  on public.billing_provider_prices
  for select
  to authenticated
  using (public.is_platform_admin());

create policy billing_provider_prices_platform_manage
  on public.billing_provider_prices
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());;
