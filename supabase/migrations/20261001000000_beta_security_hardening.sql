-- Reduce the callable surface before inviting beta users. Trigger functions do
-- not need direct API execution; credential readers remain service-only.
revoke all on function public.crm_provider_availability() from public, anon;
grant execute on function public.crm_provider_availability() to authenticated;

revoke all on function public.get_crm_provider_credentials(text) from public, anon, authenticated;
grant execute on function public.get_crm_provider_credentials(text) to service_role;

revoke all on function public.get_crm_connection_tokens(uuid) from public, anon, authenticated;
grant execute on function public.get_crm_connection_tokens(uuid) to service_role;

revoke all on function public.prevent_last_super_admin() from public, anon, authenticated;
revoke all on function public.guard_profile_security_fields() from public, anon, authenticated;
revoke all on function public.guard_workspace_security_fields() from public, anon, authenticated;
revoke all on function public.install_default_scrape_sources() from public, anon, authenticated;
revoke all on function public.notify_crm_record_issue() from public, anon, authenticated;
revoke all on function public.notify_crm_record_failure() from public, anon, authenticated;

alter function public.prevent_last_super_admin() set search_path = public;
