alter table public.crm_record_links
  add column if not exists conflict_resolution text
    check (conflict_resolution is null or conflict_resolution in ('keep_local', 'use_external')),
  add column if not exists external_snapshot jsonb;

create index if not exists crm_record_links_open_issues_idx
  on public.crm_record_links (workspace_id, connection_id, updated_at desc)
  where sync_status in ('conflict', 'error');

