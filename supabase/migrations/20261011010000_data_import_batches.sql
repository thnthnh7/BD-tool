-- Audited, resumable boundary between reviewed Data Library records and CRM.

create table public.data_import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('company', 'contact')),
  duplicate_policy text not null default 'skip' check (duplicate_policy in ('skip', 'update')),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  total_count integer not null default 0,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index data_import_batches_workspace_idx on public.data_import_batches (workspace_id, created_at desc);

create table public.data_import_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  batch_id uuid not null references public.data_import_batches (id) on delete cascade,
  record_id uuid not null references public.data_records (id) on delete cascade,
  status text not null check (status in ('imported', 'updated', 'skipped', 'failed')),
  reason text not null default '',
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, record_id)
);

create index data_import_items_batch_idx on public.data_import_items (batch_id, status);

alter table public.data_import_batches enable row level security;
alter table public.data_import_items enable row level security;

create policy data_import_batches_member_read on public.data_import_batches
for select using (workspace_id = public.current_workspace_id());
create policy data_import_batches_member_insert on public.data_import_batches
for insert with check (workspace_id = public.current_workspace_id() and created_by = auth.uid());
create policy data_import_batches_creator_update on public.data_import_batches
for update using (workspace_id = public.current_workspace_id() and created_by = auth.uid())
with check (workspace_id = public.current_workspace_id() and created_by = auth.uid());

create policy data_import_items_member_read on public.data_import_items
for select using (workspace_id = public.current_workspace_id());
create policy data_import_items_creator_insert on public.data_import_items
for insert with check (
  workspace_id = public.current_workspace_id()
  and exists (
    select 1 from public.data_import_batches batch
    where batch.id = data_import_items.batch_id
      and batch.workspace_id = data_import_items.workspace_id
      and batch.created_by = auth.uid()
  )
);

