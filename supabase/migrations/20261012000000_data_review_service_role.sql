-- Background Apify ingestion uses the service role, while interactive review
-- remains scoped to the authenticated user's active workspace.
create or replace function public.refresh_data_collection_review(p_collection_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.data_collections
  where id = p_collection_id
    and (auth.role() = 'service_role' or workspace_id = public.current_workspace_id());

  if v_workspace_id is null then
    raise exception 'Collection not found';
  end if;

  update public.data_records records
  set duplicate_of_id = (
        select candidate.id
        from public.data_records candidate
        where candidate.workspace_id = records.workspace_id
          and records.identity_fingerprint <> ''
          and candidate.identity_fingerprint = records.identity_fingerprint
          and candidate.id <> records.id
          and (candidate.captured_at, candidate.id) < (records.captured_at, records.id)
        order by candidate.captured_at, candidate.id
        limit 1
      ),
      review_status = case
        when exists (
          select 1 from public.data_suppressions suppression
          where suppression.workspace_id = records.workspace_id
            and records.identity_keys ->> suppression.identity_type = suppression.identity_value
        ) then 'suppressed'
        when exists (
          select 1 from public.data_records candidate
          where candidate.workspace_id = records.workspace_id
            and records.identity_fingerprint <> ''
            and candidate.identity_fingerprint = records.identity_fingerprint
            and candidate.id <> records.id
            and (candidate.captured_at, candidate.id) < (records.captured_at, records.id)
        ) then 'duplicate'
        when records.promoted_company_id is not null or records.promoted_contact_id is not null then 'imported'
        when records.quality_score >= 50 then 'ready'
        else 'pending'
      end
  where records.collection_id = p_collection_id;

  update public.data_records records
  set duplicate_of_id = null,
      review_status = case
        when exists (
          select 1 from public.data_suppressions suppression
          where suppression.workspace_id = records.workspace_id
            and records.identity_keys ->> suppression.identity_type = suppression.identity_value
        ) then 'suppressed'
        when records.promoted_company_id is not null or records.promoted_contact_id is not null then 'imported'
        when records.quality_score >= 50 then 'ready'
        else 'pending'
      end
  where records.collection_id = p_collection_id
    and not exists (
      select 1 from public.data_records candidate
      where candidate.workspace_id = records.workspace_id
        and records.identity_fingerprint <> ''
        and candidate.identity_fingerprint = records.identity_fingerprint
        and candidate.id <> records.id
        and (candidate.captured_at, candidate.id) < (records.captured_at, records.id)
    );
end;
$$;

grant execute on function public.refresh_data_collection_review(uuid) to authenticated;
