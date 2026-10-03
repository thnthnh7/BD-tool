create table if not exists public.billing_provider_configs (
  provider text primary key check (provider in ('stripe', 'paypal', 'sepay')),
  enabled boolean not null default false,
  mode text not null default 'test' check (mode in ('test', 'live')),
  account_label text not null default '',
  public_config jsonb not null default '{}'::jsonb,
  encrypted_credentials jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists billing_provider_configs_updated_at on public.billing_provider_configs;
create trigger billing_provider_configs_updated_at
before update on public.billing_provider_configs
for each row execute function public.set_updated_at();

alter table public.billing_provider_configs enable row level security;

create policy billing_provider_configs_platform_read on public.billing_provider_configs
for select to authenticated using (public.is_platform_admin());

create policy billing_provider_configs_super_admin_write on public.billing_provider_configs
for all to authenticated using (public.platform_role() = 'super_admin') with check (public.platform_role() = 'super_admin');

insert into public.billing_provider_configs (provider)
values ('stripe'), ('paypal'), ('sepay')
on conflict (provider) do nothing;
