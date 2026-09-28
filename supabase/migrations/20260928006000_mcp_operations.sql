-- MCP operational retention and Dynamic Client Registration abuse controls.

alter table public.mcp_oauth_clients add column registration_fingerprint text;
create index mcp_oauth_clients_registration_idx
  on public.mcp_oauth_clients (registration_fingerprint, created_at desc)
  where last_used_at is null and status = 'active';

create or replace function public.cleanup_mcp_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_requests integer;
  deleted_codes integer;
  deleted_tokens integer;
  deleted_clients integer;
  deleted_audits integer;
  deleted_keys integer;
begin
  perform public.expire_mcp_action_requests(null);

  delete from public.mcp_oauth_codes where expires_at < now() - interval '1 day';
  get diagnostics deleted_codes = row_count;

  delete from public.mcp_oauth_tokens
  where (refresh_expires_at is not null and refresh_expires_at < now() - interval '7 days')
     or (revoked_at is not null and revoked_at < now() - interval '30 days');
  get diagnostics deleted_tokens = row_count;

  delete from public.mcp_oauth_clients client
  where client.last_used_at is null
    and client.created_at < now() - interval '7 days'
    and not exists (select 1 from public.mcp_oauth_tokens token where token.client_id = client.client_id)
    and not exists (select 1 from public.mcp_oauth_codes code where code.client_id = client.client_id);
  get diagnostics deleted_clients = row_count;

  delete from public.mcp_tool_calls where created_at < now() - interval '90 days';
  get diagnostics deleted_audits = row_count;

  delete from public.mcp_idempotency_keys where created_at < now() - interval '30 days';
  get diagnostics deleted_keys = row_count;

  select count(*)::integer into expired_requests
  from public.mcp_action_requests where status = 'expired' and completed_at > now() - interval '5 minutes';

  return jsonb_build_object(
    'expiredRequests', expired_requests,
    'deletedCodes', deleted_codes,
    'deletedTokens', deleted_tokens,
    'deletedClients', deleted_clients,
    'deletedAuditRows', deleted_audits,
    'deletedIdempotencyKeys', deleted_keys
  );
end;
$$;

revoke all on function public.cleanup_mcp_data() from public, anon, authenticated;
grant execute on function public.cleanup_mcp_data() to service_role;
