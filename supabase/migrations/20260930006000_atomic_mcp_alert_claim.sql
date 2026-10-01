create or replace function public.claim_mcp_alert_delivery(
  p_fingerprint text,
  p_sent_at timestamptz,
  p_cooldown_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_settings public.mcp_settings%rowtype;
begin
  select * into current_settings from public.mcp_settings where id = 1 for update;
  if current_settings.last_alert_fingerprint = p_fingerprint
     and current_settings.last_alert_sent_at > p_sent_at - make_interval(mins => greatest(5, p_cooldown_minutes)) then
    return false;
  end if;
  update public.mcp_settings
  set last_alert_fingerprint = p_fingerprint, last_alert_sent_at = p_sent_at
  where id = 1;
  return true;
end;
$$;

revoke all on function public.claim_mcp_alert_delivery(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_mcp_alert_delivery(text, timestamptz, integer) to service_role;
