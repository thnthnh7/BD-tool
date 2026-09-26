create extension if not exists vector with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-files',
  'knowledge-files',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null default '',
  byte_size bigint not null default 0,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'error', 'archived')),
  extracted_chars integer not null default 0,
  chunk_count integer not null default 0,
  error_message text not null default '',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, storage_path)
);

create index knowledge_documents_workspace_idx
  on public.knowledge_documents (workspace_id, created_at desc);

create trigger knowledge_documents_updated_at
before update on public.knowledge_documents
for each row execute function public.set_updated_at();

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(384) not null,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_chunks_workspace_idx on public.knowledge_chunks (workspace_id, document_id);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin (search_vector);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.knowledge_module_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  name text not null,
  description text not null default '',
  suggested_price integer not null default 0,
  source_excerpt text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index knowledge_module_drafts_workspace_idx
  on public.knowledge_module_drafts (workspace_id, status, created_at desc);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_module_drafts enable row level security;

create policy knowledge_documents_member_all on public.knowledge_documents
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy knowledge_chunks_member_all on public.knowledge_chunks
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy knowledge_module_drafts_member_all on public.knowledge_module_drafts
for all using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy knowledge_files_member_select on storage.objects
for select using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
);

create policy knowledge_files_member_insert on storage.objects
for insert with check (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
);

create policy knowledge_files_member_update on storage.objects
for update using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
) with check (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
);

create policy knowledge_files_member_delete on storage.objects
for delete using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = public.current_workspace_id()::text
);

create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(384),
  query_text text,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  content text,
  metadata jsonb,
  similarity double precision,
  text_rank real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.file_name,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', query_text)) as text_rank
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.workspace_id = public.current_workspace_id()
    and d.status = 'ready'
  order by (
    (1 - (c.embedding <=> query_embedding)) * 0.72
    + least(ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', query_text)), 1) * 0.28
  ) desc
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_knowledge_chunks(extensions.vector, text, integer) to authenticated;
