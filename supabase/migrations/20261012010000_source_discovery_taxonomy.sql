-- Discovery facets derived from public Actor metadata. These tags describe
-- suitability and output, while Apify categories remain the upstream taxonomy.
alter table public.scrape_sources
  add column if not exists use_cases text[] not null default '{}',
  add column if not exists industries text[] not null default '{}',
  add column if not exists platforms text[] not null default '{}',
  add column if not exists data_types text[] not null default '{}',
  add column if not exists classification_version text not null default 'rules-v1',
  add column if not exists classified_at timestamptz;

create index if not exists scrape_sources_use_cases_idx on public.scrape_sources using gin (use_cases);
create index if not exists scrape_sources_industries_idx on public.scrape_sources using gin (industries);
create index if not exists scrape_sources_platforms_idx on public.scrape_sources using gin (platforms);
create index if not exists scrape_sources_data_types_idx on public.scrape_sources using gin (data_types);

create or replace function public.apply_scrape_source_taxonomy(p_rows jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with input as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as item(
      id uuid,
      use_cases text[],
      industries text[],
      platforms text[],
      data_types text[]
    )
  ), updated as (
    update public.scrape_sources source
    set use_cases = coalesce(input.use_cases, '{}'),
        industries = coalesce(input.industries, '{}'),
        platforms = coalesce(input.platforms, '{}'),
        data_types = coalesce(input.data_types, '{}'),
        classification_version = 'rules-v1',
        classified_at = now()
    from input
    where source.id = input.id
    returning source.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.apply_scrape_source_taxonomy(jsonb) from public, anon, authenticated;
grant execute on function public.apply_scrape_source_taxonomy(jsonb) to service_role;

comment on column public.scrape_sources.use_cases is 'Bizcraw discovery use cases derived from Actor metadata.';
comment on column public.scrape_sources.industries is 'Industries where the Actor data is likely useful.';
comment on column public.scrape_sources.platforms is 'Web platforms or source families covered by the Actor.';
comment on column public.scrape_sources.data_types is 'Structured data types likely produced by the Actor.';
