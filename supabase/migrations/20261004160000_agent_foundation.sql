-- Bizcraw in-app Agent: conversations, read audit, confirmations, and import jobs.
-- Retention is not applied here. A later job will delete rows after a retention period is chosen.

alter table public.ai_usage_events
  add column if not exists degraded boolean not null default false,
  add column if not exists request_id text;

create table if not exists public.workspace_agent_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  enabled boolean not null default true,
  allow_platform_fallback boolean not null default true,
  write_enabled boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  unread boolean not null default false,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_conversations_owner_idx
  on public.agent_conversations (workspace_id, user_id, updated_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'summary')),
  content text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'complete' check (status in ('streaming', 'complete', 'canceled', 'error')),
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at);

create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  message_id uuid references public.agent_messages (id) on delete set null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_id text,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  status text not null check (status in ('success', 'error', 'canceled')),
  latency_ms integer not null default 0,
  record_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists agent_tool_calls_conversation_idx
  on public.agent_tool_calls (conversation_id, created_at desc);

create table if not exists public.agent_entity_refs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('company', 'contact', 'lead', 'deal', 'quote', 'task')),
  entity_id uuid not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (conversation_id, entity_type, entity_id)
);

create table if not exists public.agent_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.agent_conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size integer not null,
  extracted_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  tool_name text not null,
  tier integer not null check (tier in (2, 3)),
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'waiting_for_confirmation'
    check (status in ('waiting_for_confirmation', 'approved', 'running', 'completed', 'partially_completed', 'failed', 'canceled', 'expired')),
  preview jsonb not null default '{}'::jsonb,
  result jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_approvals_hash_uidx
  on public.agent_approvals (workspace_id, user_id, tool_name, payload_hash)
  where status = 'waiting_for_confirmation';

create table if not exists public.agent_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tool_name text not null,
  idempotency_key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, tool_name, idempotency_key)
);

create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  kind text not null check (kind in ('import')),
  status text not null default 'waiting'
    check (status in ('waiting', 'queued', 'running', 'completed', 'partially_completed', 'failed', 'canceled')),
  file_name text not null default '',
  mapping jsonb not null default '{}'::jsonb,
  duplicate_policy text not null default 'skip' check (duplicate_policy in ('skip', 'update', 'create')),
  list_name text not null default '',
  cursor_row integer not null default 0,
  counts jsonb not null default '{}'::jsonb,
  plan_snapshot jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  row_number integer not null,
  raw jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'created', 'updated', 'skipped', 'failed')),
  error_message text not null default '',
  record_id uuid,
  unique (job_id, row_number)
);

create index if not exists agent_import_rows_job_idx
  on public.agent_import_rows (job_id, row_number);

alter table public.workspace_agent_settings enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_entity_refs enable row level security;
alter table public.agent_attachments enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_idempotency_keys enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_import_rows enable row level security;

create policy workspace_agent_settings_select on public.workspace_agent_settings
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

create policy workspace_agent_settings_write on public.workspace_agent_settings
  for all using (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  );

create policy agent_conversations_own on public.agent_conversations
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_messages_own on public.agent_messages
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_tool_calls_own on public.agent_tool_calls
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_entity_refs_own on public.agent_entity_refs
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_attachments_own on public.agent_attachments
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_approvals_own on public.agent_approvals
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_idempotency_keys_own on public.agent_idempotency_keys
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_jobs_own on public.agent_jobs
  for all using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

create policy agent_import_rows_own on public.agent_import_rows
  for all using (
    workspace_id = public.current_workspace_id()
    and exists (
      select 1 from public.agent_jobs j
      where j.id = job_id and j.user_id = auth.uid() and j.workspace_id = public.current_workspace_id()
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and exists (
      select 1 from public.agent_jobs j
      where j.id = job_id and j.user_id = auth.uid() and j.workspace_id = public.current_workspace_id()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-attachments',
  'agent-attachments',
  false,
  2000000,
  array['text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy agent_attachments_storage_select on storage.objects
for select using (
  bucket_id = 'agent-attachments'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy agent_attachments_storage_insert on storage.objects
for insert with check (
  bucket_id = 'agent-attachments'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy agent_attachments_storage_delete on storage.objects
for delete using (
  bucket_id = 'agent-attachments'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.agent_fuzzy_names(p_kind text, p_query text, p_limit integer)
returns table (id uuid, label text, score real, updated_at timestamptz)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  needle text := left(btrim(coalesce(p_query, '')), 120);
  cap integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if needle = '' then
    return;
  end if;
  if p_kind = 'company' then
    return query
      select c.id, c.name, similarity(c.name, needle), c.updated_at
      from public.companies c
      where c.workspace_id = public.current_workspace_id()
        and similarity(c.name, needle) > 0.2
      order by similarity(c.name, needle) desc
      limit cap;
  elsif p_kind = 'contact' then
    return query
      select c.id, c.display_name, similarity(c.display_name, needle), c.updated_at
      from public.contacts c
      where c.workspace_id = public.current_workspace_id()
        and similarity(c.display_name, needle) > 0.2
      order by similarity(c.display_name, needle) desc
      limit cap;
  elsif p_kind = 'deal' then
    return query
      select d.id, d.title, similarity(d.title, needle), d.updated_at
      from public.deals d
      where d.workspace_id = public.current_workspace_id()
        and similarity(d.title, needle) > 0.2
      order by similarity(d.title, needle) desc
      limit cap;
  elsif p_kind = 'quote' then
    return query
      select q.id, q.title, similarity(q.title, needle), q.updated_at
      from public.quotes q
      where q.workspace_id = public.current_workspace_id()
        and similarity(q.title, needle) > 0.2
      order by similarity(q.title, needle) desc
      limit cap;
  elsif p_kind = 'task' then
    return query
      select t.id, t.title, similarity(t.title, needle), t.updated_at
      from public.tasks t
      where t.workspace_id = public.current_workspace_id()
        and similarity(t.title, needle) > 0.2
      order by similarity(t.title, needle) desc
      limit cap;
  end if;
end;
$$;;
