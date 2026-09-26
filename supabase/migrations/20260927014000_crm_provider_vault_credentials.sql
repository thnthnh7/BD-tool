create extension if not exists supabase_vault with schema vault;

alter table public.crm_provider_configs
  add column if not exists client_id_secret_id uuid,
  add column if not exists client_secret_secret_id uuid;

create or replace function public.set_crm_provider_credentials(
  p_provider text,
  p_client_id text default null,
  p_client_secret text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_config public.crm_provider_configs%rowtype;
  v_client_id_id uuid;
  v_client_secret_id uuid;
begin
  if public.platform_role() is distinct from 'super_admin' then
    raise exception 'Only a super admin can manage CRM credentials';
  end if;

  select * into v_config from public.crm_provider_configs where provider = p_provider for update;
  if not found then raise exception 'Unsupported CRM provider'; end if;

  v_client_id_id := v_config.client_id_secret_id;
  v_client_secret_id := v_config.client_secret_secret_id;

  if nullif(trim(p_client_id), '') is not null then
    if v_client_id_id is null then
      select vault.create_secret(p_client_id, 'crm_' || p_provider || '_client_id', 'Leadely CRM OAuth client ID') into v_client_id_id;
    else
      perform vault.update_secret(v_client_id_id, p_client_id);
    end if;
  end if;

  if nullif(trim(p_client_secret), '') is not null then
    if v_client_secret_id is null then
      select vault.create_secret(p_client_secret, 'crm_' || p_provider || '_client_secret', 'Leadely CRM OAuth client secret') into v_client_secret_id;
    else
      perform vault.update_secret(v_client_secret_id, p_client_secret);
    end if;
  end if;

  update public.crm_provider_configs
  set client_id_secret_id = v_client_id_id,
      client_secret_secret_id = v_client_secret_id,
      updated_by = auth.uid()
  where provider = p_provider;
end;
$$;

create or replace function public.get_crm_provider_credentials(p_provider text)
returns table (client_id text, client_secret text)
language sql
stable
security definer
set search_path = public, vault
as $$
  select client_id.secret, client_secret.secret
  from public.crm_provider_configs config
  left join vault.decrypted_secrets client_id on client_id.id = config.client_id_secret_id
  left join vault.decrypted_secrets client_secret on client_secret.id = config.client_secret_secret_id
  where config.provider = p_provider
    and (auth.jwt() ->> 'role') = 'service_role';
$$;

revoke all on function public.set_crm_provider_credentials(text, text, text) from public;
grant execute on function public.set_crm_provider_credentials(text, text, text) to authenticated;
revoke all on function public.get_crm_provider_credentials(text) from public, authenticated;
grant execute on function public.get_crm_provider_credentials(text) to service_role;

