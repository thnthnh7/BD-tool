drop function if exists public.crm_provider_availability();

create function public.crm_provider_availability()
returns table (provider text, enabled boolean, rollout_status text, credentials_configured boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.provider,
    c.enabled,
    c.rollout_status,
    (c.client_id_secret_id is not null and c.client_secret_secret_id is not null) as credentials_configured
  from public.crm_provider_configs c
  where auth.uid() is not null;
$$;

revoke all on function public.crm_provider_availability() from public;
grant execute on function public.crm_provider_availability() to authenticated;

