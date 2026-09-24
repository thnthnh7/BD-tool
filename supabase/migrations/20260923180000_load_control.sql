-- Atomic monthly quota, short admission windows, and one active scrape job per workspace.

-- ---------------------------------------------------------------------------
-- Quota
-- ---------------------------------------------------------------------------

create or replace function public.consume_quota(
  p_workspace_id uuid,
  p_field text,
  p_amount integer,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_updated integer;
begin
  if p_amount <= 0 then
    return true;
  end if;

  if p_field not in ('quotes_created', 'ai_briefs', 'maps_scrapes', 'maps_places', 'maps_people') then
    raise exception 'invalid usage field';
  end if;

  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null then
      raise exception 'not authenticated';
    end if;
    if not exists (
      select 1
      from public.workspace_members
      where user_id = auth.uid()
        and workspace_id = p_workspace_id
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  insert into public.usage_counters (workspace_id, period)
  values (p_workspace_id, v_period)
  on conflict (workspace_id, period) do nothing;

  perform 1
  from public.usage_counters
  where workspace_id = p_workspace_id
    and period = v_period
  for update;

  update public.usage_counters
  set
    quotes_created = quotes_created + case when p_field = 'quotes_created' then p_amount else 0 end,
    ai_briefs = ai_briefs + case when p_field = 'ai_briefs' then p_amount else 0 end,
    maps_scrapes = maps_scrapes + case when p_field = 'maps_scrapes' then p_amount else 0 end,
    maps_places = maps_places + case when p_field = 'maps_places' then p_amount else 0 end,
    maps_people = maps_people + case when p_field = 'maps_people' then p_amount else 0 end
  where workspace_id = p_workspace_id
    and period = v_period
    and (
      p_limit < 0
      or case p_field
        when 'quotes_created' then quotes_created
        when 'ai_briefs' then ai_briefs
        when 'maps_scrapes' then maps_scrapes
        when 'maps_places' then maps_places
        when 'maps_people' then maps_people
      end + p_amount <= p_limit
    );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.consume_quota(uuid, text, integer, integer) from public, anon;
grant execute on function public.consume_quota(uuid, text, integer, integer) to authenticated, service_role;

drop policy if exists usage_insert_member on public.usage_counters;
drop policy if exists usage_update_member on public.usage_counters;

-- ---------------------------------------------------------------------------
-- Admission
-- ---------------------------------------------------------------------------

create table public.admission_windows (
  subject text not null,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (subject, bucket, window_start)
);

create table public.admission_holds (
  subject text not null,
  bucket text not null,
  expires_at timestamptz not null,
  primary key (subject, bucket)
);

alter table public.admission_windows enable row level security;
alter table public.admission_holds enable row level security;

create or replace function public.assert_admission_subject(p_subject text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_subject = auth.uid()::text or p_subject = public.current_workspace_id()::text then
    return;
  end if;
  raise exception 'forbidden';
end;
$$;

revoke all on function public.assert_admission_subject(text) from public, anon;

create or replace function public.admit(
  p_subject text,
  p_bucket text,
  p_max_hits integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_subject is null or length(trim(p_subject)) = 0 or p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'invalid admission subject';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid admission window';
  end if;
  perform public.assert_admission_subject(p_subject);
  if p_max_hits is null or p_max_hits < 1 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.admission_windows (subject, bucket, window_start, hits)
  values (p_subject, p_bucket, v_window, 1)
  on conflict (subject, bucket, window_start)
  do update set hits = admission_windows.hits + 1
  where admission_windows.hits < p_max_hits
  returning hits into v_hits;

  return v_hits is not null;
end;
$$;

create or replace function public.acquire_hold(
  p_subject text,
  p_bucket text,
  p_ttl_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text;
begin
  if p_ttl_seconds is null or p_ttl_seconds < 1 then
    raise exception 'invalid hold ttl';
  end if;
  perform public.assert_admission_subject(p_subject);

  insert into public.admission_holds (subject, bucket, expires_at)
  values (p_subject, p_bucket, now() + make_interval(secs => p_ttl_seconds))
  on conflict (subject, bucket)
  do update set expires_at = excluded.expires_at
  where admission_holds.expires_at < now()
  returning subject into v_subject;

  return v_subject is not null;
end;
$$;

create or replace function public.release_hold(
  p_subject text,
  p_bucket text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admission_subject(p_subject);
  delete from public.admission_holds
  where subject = p_subject
    and bucket = p_bucket;
end;
$$;

revoke all on function public.admit(text, text, integer, integer) from public, anon;
revoke all on function public.acquire_hold(text, text, integer) from public, anon;
revoke all on function public.release_hold(text, text) from public, anon;
grant execute on function public.admit(text, text, integer, integer) to authenticated, service_role;
grant execute on function public.acquire_hold(text, text, integer) to authenticated, service_role;
grant execute on function public.release_hold(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Scrape: one active job, ingest claim, lookup indexes
-- ---------------------------------------------------------------------------

with ranked as (
  select
    id,
    row_number() over (partition by workspace_id order by created_at desc) as n
  from public.lead_scrape_jobs
  where status in ('queued', 'running')
)
update public.lead_scrape_jobs
set
  status = 'failed',
  error_message = 'Superseded by a newer active scrape job.',
  finished_at = coalesce(finished_at, now())
where id in (select id from ranked where n > 1);

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'lead_scrape_jobs'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.lead_scrape_jobs drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.lead_scrape_jobs
  add constraint lead_scrape_jobs_status_check
  check (status in ('queued', 'running', 'ingesting', 'succeeded', 'failed', 'canceled'));

create unique index lead_scrape_jobs_one_active_uidx
  on public.lead_scrape_jobs (workspace_id)
  where status in ('queued', 'running', 'ingesting');

create index if not exists companies_workspace_domain_idx
  on public.companies (workspace_id, lower(domain))
  where domain <> '';

create index if not exists contacts_workspace_email_idx
  on public.contacts (workspace_id, lower(email))
  where email <> '';

create or replace function public.lookup_companies_for_ingest(
  p_workspace_id uuid,
  p_place_ids text[],
  p_domains text[]
) returns table (
  id uuid,
  external_place_id text,
  domain text,
  phone text,
  name text,
  address text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.external_place_id, c.domain, c.phone, c.name, c.address
  from public.companies c
  where c.workspace_id = p_workspace_id
    and (
      (cardinality(coalesce(p_place_ids, '{}')) > 0 and c.external_place_id = any(p_place_ids))
      or (cardinality(coalesce(p_domains, '{}')) > 0 and c.domain <> '' and lower(c.domain) = any(p_domains))
    );
$$;

create or replace function public.lookup_contacts_for_ingest(
  p_workspace_id uuid,
  p_emails text[]
) returns table (
  id uuid,
  email text,
  company_id uuid,
  display_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.email, c.company_id, c.display_name
  from public.contacts c
  where c.workspace_id = p_workspace_id
    and c.email <> ''
    and cardinality(coalesce(p_emails, '{}')) > 0
    and lower(c.email) = any(p_emails);
$$;

revoke all on function public.lookup_companies_for_ingest(uuid, text[], text[]) from public, anon;
revoke all on function public.lookup_contacts_for_ingest(uuid, text[]) from public, anon;
grant execute on function public.lookup_companies_for_ingest(uuid, text[], text[]) to authenticated, service_role;
grant execute on function public.lookup_contacts_for_ingest(uuid, text[]) to authenticated, service_role;
