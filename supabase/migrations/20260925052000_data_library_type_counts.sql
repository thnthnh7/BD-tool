create or replace function public.data_library_type_counts()
returns table(record_type text, record_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select records.record_type, count(*)::bigint
  from public.data_records records
  where records.workspace_id = public.current_workspace_id()
  group by records.record_type
  order by count(*) desc, records.record_type;
$$;

grant execute on function public.data_library_type_counts() to authenticated;
