create or replace function public.notify_crm_record_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sync_status in ('conflict', 'error')
     and new.sync_status is distinct from old.sync_status then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select new.workspace_id, member.user_id,
      case when new.sync_status = 'conflict' then 'CRM conflict needs review' else 'CRM record sync failed' end,
      case when new.sync_status = 'conflict'
        then initcap(new.object_type) || ' record ' || new.external_record_id || ' changed in both systems.'
        else coalesce(nullif(new.last_error, ''), initcap(new.object_type) || ' record could not be synchronized.')
      end,
      case when new.sync_status = 'conflict' then 'warning' else 'error' end,
      'crm_record_link', new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id and member.role in ('owner', 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists crm_record_links_notify_issue on public.crm_record_links;
create trigger crm_record_links_notify_issue
after update of sync_status on public.crm_record_links
for each row execute function public.notify_crm_record_issue();

create or replace function public.notify_crm_sync_run_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('partial', 'dead_letter') and new.status is distinct from old.status then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select new.workspace_id, member.user_id,
      case when new.status = 'dead_letter' then 'CRM sync stopped after retries' else 'CRM sync completed with errors' end,
      coalesce(nullif(new.error_summary, ''), new.records_failed || ' record(s) could not be synchronized.'),
      'error', 'crm_sync_run', new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id and member.role in ('owner', 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists crm_sync_runs_notify_failure on public.crm_sync_runs;
create trigger crm_sync_runs_notify_failure
after update of status on public.crm_sync_runs
for each row execute function public.notify_crm_sync_run_failure();

