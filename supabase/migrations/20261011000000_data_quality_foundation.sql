-- Data quality foundation: provenance, review state, duplicate detection and suppression.

alter table public.data_records
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists identity_fingerprint text not null default '',
  add column if not exists quality_score integer not null default 0 check (quality_score between 0 and 100),
  add column if not exists quality_issues text[] not null default '{}'::text[],
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'ready', 'duplicate', 'suppressed', 'imported')),
  add column if not exists duplicate_of_id uuid references public.data_records (id) on delete set null;

create index if not exists data_records_workspace_fingerprint_idx
  on public.data_records (workspace_id, identity_fingerprint, captured_at, id)
  where identity_fingerprint <> '';
create index if not exists data_records_workspace_review_idx
  on public.data_records (workspace_id, review_status, quality_score desc, captured_at desc);
create index if not exists data_records_duplicate_idx on public.data_records (duplicate_of_id)
  where duplicate_of_id is not null;

create table if not exists public.data_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  identity_type text not null check (identity_type in ('email', 'phone', 'url', 'external_id', 'username')),
  identity_value text not null,
  reason text not null default 'manual',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, identity_type, identity_value)
);

create index if not exists data_suppressions_workspace_idx
  on public.data_suppressions (workspace_id, created_at desc);

alter table public.data_suppressions enable row level security;

create policy data_suppressions_member_read on public.data_suppressions
for select using (workspace_id = public.current_workspace_id());

create policy data_suppressions_admin_write on public.data_suppressions
for all using (
  workspace_id = public.current_workspace_id()
  and public.current_member_role() in ('owner', 'admin')
) with check (
  workspace_id = public.current_workspace_id()
  and public.current_member_role() in ('owner', 'admin')
);

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
  where id = p_collection_id and workspace_id = public.current_workspace_id();

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

create or replace function public.set_data_record_suppression(
  p_record_id uuid,
  p_suppressed boolean,
  p_reason text default 'manual'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record public.data_records%rowtype;
  v_key record;
  v_collection_id uuid;
begin
  if public.current_member_role() not in ('owner', 'admin') then
    raise exception 'Only workspace owners and admins can change suppressions';
  end if;

  select * into v_record from public.data_records
  where id = p_record_id and workspace_id = public.current_workspace_id();
  if v_record.id is null then raise exception 'Record not found'; end if;

  for v_key in
    select key, value #>> '{}' as value
    from jsonb_each(v_record.identity_keys)
    where key in ('email', 'phone', 'url', 'external_id', 'username') and value #>> '{}' <> ''
  loop
    if p_suppressed then
      insert into public.data_suppressions (workspace_id, identity_type, identity_value, reason, created_by)
      values (v_record.workspace_id, v_key.key, v_key.value, left(coalesce(nullif(p_reason, ''), 'manual'), 200), auth.uid())
      on conflict (workspace_id, identity_type, identity_value)
      do update set reason = excluded.reason;
    else
      delete from public.data_suppressions
      where workspace_id = v_record.workspace_id
        and identity_type = v_key.key and identity_value = v_key.value;
    end if;
  end loop;

  for v_collection_id in
    select distinct records.collection_id
    from public.data_records records
    where records.workspace_id = v_record.workspace_id
      and exists (
        select 1 from jsonb_each_text(v_record.identity_keys) source_key
        where source_key.key in ('email', 'phone', 'url', 'external_id', 'username')
          and records.identity_keys ->> source_key.key = source_key.value
      )
  loop
    perform public.refresh_data_collection_review(v_collection_id);
  end loop;
end;
$$;

grant execute on function public.set_data_record_suppression(uuid, boolean, text) to authenticated;

-- Existing records get a stable identity key and conservative review score.
update public.data_records
set identity_fingerprint = case
      when coalesce(identity_keys ->> 'email', '') <> '' then md5('email:' || lower(identity_keys ->> 'email'))
      when coalesce(identity_keys ->> 'phone', '') <> '' then md5('phone:' || regexp_replace(identity_keys ->> 'phone', '\D', '', 'g'))
      when coalesce(identity_keys ->> 'external_id', '') <> '' then md5('external_id:' || (identity_keys ->> 'external_id'))
      when coalesce(identity_keys ->> 'url', '') <> '' then md5('url:' || lower(identity_keys ->> 'url'))
      when coalesce(identity_keys ->> 'username', '') <> '' then md5('username:' || lower(identity_keys ->> 'username'))
      else ''
    end,
    quality_score = least(100,
      (case when title <> '' then 20 else 0 end)
      + (case when identity_keys <> '{}'::jsonb then 25 else 0 end)
      + (case when canonical_url <> '' then 20 else 0 end)
      + (case when coalesce(normalized_data ->> 'description', '') <> '' then 10 else 0 end)
      + (case when coalesce(identity_keys ->> 'email', '') <> '' then 15 else 0 end)
      + (case when coalesce(identity_keys ->> 'phone', '') <> '' then 10 else 0 end)
    ),
    provenance = jsonb_strip_nulls(jsonb_build_object(
      'provider', 'apify',
      'collection_id', collection_id,
      'captured_at', captured_at
    ));

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
    end;
