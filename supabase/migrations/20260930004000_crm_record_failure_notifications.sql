create or replace function public.notify_crm_record_failure()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select new.workspace_id, member.user_id, 'CRM record sync failed',
      initcap(new.object_type) || ' record ' || new.external_record_id || ': ' || left(new.error_message, 500),
      'error', 'crm_sync_record_failure', new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id and member.role in ('owner', 'admin');
  end if;
  return new;
end; $$;

drop trigger if exists crm_sync_record_failures_notify on public.crm_sync_record_failures;
create trigger crm_sync_record_failures_notify
after insert or update of status on public.crm_sync_record_failures
for each row execute function public.notify_crm_record_failure();

