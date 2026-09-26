drop policy if exists crm_provider_configs_workspace_read on public.crm_provider_configs;

create or replace function public.crm_provider_availability()
returns table (provider text, enabled boolean, rollout_status text)
language sql
stable
security definer
set search_path = public
as $$
  select c.provider, c.enabled, c.rollout_status
  from public.crm_provider_configs c
  where auth.uid() is not null;
$$;

revoke all on function public.crm_provider_availability() from public;
grant execute on function public.crm_provider_availability() to authenticated;

