-- Workspace-scoped hybrid retrieval for trusted MCP service calls.
create or replace function public.match_mcp_knowledge_chunks(
  p_workspace_id uuid,
  p_connection_id uuid,
  query_embedding extensions.vector(384),
  query_text text,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision,
  text_rank real
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.mcp_connections mc
    where mc.id = p_connection_id
      and mc.workspace_id = p_workspace_id
      and mc.status = 'active'
      and mc.scopes @> array['knowledge:read']::text[]
  ) then
    raise exception 'MCP connection is not authorized for knowledge:read';
  end if;

  return query
  select
    c.id,
    c.document_id,
    d.file_name,
    c.chunk_index,
    left(c.content, 4000),
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', query_text)) as text_rank
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.workspace_id = p_workspace_id
    and d.workspace_id = p_workspace_id
    and d.status = 'ready'
  order by (
    (1 - (c.embedding <=> query_embedding)) * 0.72
    + least(ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', query_text)), 1) * 0.28
  ) desc
  limit greatest(1, least(match_count, 20));
end;
$$;

revoke all on function public.match_mcp_knowledge_chunks(uuid, uuid, extensions.vector, text, integer) from public, anon, authenticated;
grant execute on function public.match_mcp_knowledge_chunks(uuid, uuid, extensions.vector, text, integer) to service_role;
