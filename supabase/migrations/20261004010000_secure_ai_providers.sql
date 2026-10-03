-- Keep workspace AI credentials server-side and replace the default provider atomically.
drop policy if exists workspace_ai_providers_member_all on public.workspace_ai_providers;

create or replace function public.replace_workspace_ai_provider(
  target_workspace_id uuid,
  provider_name text,
  provider_base_url text,
  provider_model text,
  provider_encrypted_api_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_provider_id uuid;
begin
  if not exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  ) then
    raise exception 'Only workspace owners and admins can manage AI providers';
  end if;

  if provider_name not in ('openai', 'openrouter', 'groq', 'custom') then
    raise exception 'Unsupported AI provider';
  end if;

  update public.workspace_ai_providers
  set is_default = false
  where workspace_id = target_workspace_id
    and is_default = true;

  insert into public.workspace_ai_providers (
    workspace_id, provider, base_url, model, encrypted_api_key,
    is_default, status, created_by, last_tested_at
  ) values (
    target_workspace_id, provider_name, provider_base_url, provider_model,
    provider_encrypted_api_key, true, 'active', auth.uid(), now()
  )
  returning id into new_provider_id;

  return new_provider_id;
end;
$$;

revoke all on function public.replace_workspace_ai_provider(uuid, text, text, text, text) from public;
grant execute on function public.replace_workspace_ai_provider(uuid, text, text, text, text) to authenticated;
