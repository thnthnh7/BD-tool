create table if not exists public.crm_provider_configs (
  provider text primary key check (provider in (
    'hubspot', 'salesforce', 'dynamics_365', 'zoho', 'pipedrive',
    'freshsales', 'monday', 'close', 'bitrix24', 'activecampaign'
  )),
  enabled boolean not null default false,
  rollout_status text not null default 'not_configured'
    check (rollout_status in ('not_configured', 'testing', 'available', 'maintenance')),
  notes text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger crm_provider_configs_updated_at
before update on public.crm_provider_configs
for each row execute function public.set_updated_at();

insert into public.crm_provider_configs (provider)
values
  ('hubspot'), ('salesforce'), ('dynamics_365'), ('zoho'), ('pipedrive'),
  ('freshsales'), ('monday'), ('close'), ('bitrix24'), ('activecampaign')
on conflict (provider) do nothing;

alter table public.crm_provider_configs enable row level security;

create policy crm_provider_configs_platform_read on public.crm_provider_configs
  for select using (public.is_platform_admin());
create policy crm_provider_configs_super_admin_write on public.crm_provider_configs
  for all using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy crm_provider_configs_workspace_read on public.crm_provider_configs
  for select using (public.current_workspace_id() is not null);

create policy crm_connections_platform_read on public.crm_connections
  for select using (public.is_platform_admin());

