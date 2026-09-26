-- Backfill existing scrape output into the workspace data library.

insert into public.data_collections (
  workspace_id, scrape_job_id, name, description, source_type, source_actor_id,
  external_dataset_id, record_count, status, created_by, created_at, updated_at
)
select
  j.workspace_id,
  j.id,
  coalesce(nullif(j.query, ''), j.apify_actor_id),
  j.location,
  'apify_dataset',
  j.apify_actor_id,
  j.apify_dataset_id,
  count(r.id)::integer,
  'active',
  j.created_by,
  j.created_at,
  j.updated_at
from public.lead_scrape_jobs j
join public.lead_scrape_results r on r.job_id = j.id
group by j.id
on conflict (scrape_job_id) do update set
  record_count = excluded.record_count,
  external_dataset_id = excluded.external_dataset_id,
  updated_at = excluded.updated_at;

with ranked as (
  select
    r.*,
    c.id as collection_id,
    j.apify_actor_id,
    coalesce(
      r.raw ->> 'ingest_key',
      (row_number() over (partition by r.job_id order by r.created_at, r.id) - 1)::text
    ) as item_key
  from public.lead_scrape_results r
  join public.lead_scrape_jobs j on j.id = r.job_id
  join public.data_collections c on c.scrape_job_id = r.job_id
)
insert into public.data_records (
  workspace_id, collection_id, scrape_result_id, source_item_key, record_type,
  title, canonical_url, normalized_data, raw_data, identity_keys, content_hash,
  promoted_company_id, captured_at, created_at, updated_at
)
select
  workspace_id,
  collection_id,
  id,
  item_key,
  case
    when apify_actor_id ilike '%google%map%' or google_place_id is not null then 'place'
    when raw ?| array['jobTitle', 'job_title', 'salary', 'employmentType'] then 'job_listing'
    when raw ?| array['price', 'sku', 'productId', 'product_id'] then 'product_listing'
    when raw ?| array['reviewText', 'review_text', 'reviewRating', 'stars'] then 'review'
    when raw ?| array['username', 'followersCount', 'followers_count', 'biography'] then 'person_profile'
    when raw ?| array['caption', 'hashtags', 'likesCount', 'commentsCount'] then 'social_content'
    else 'generic_record'
  end,
  coalesce(nullif(name, ''), 'Untitled'),
  coalesce(raw ->> 'url', maps_url, website, ''),
  jsonb_build_object(
    'title', coalesce(name, ''), 'url', coalesce(raw ->> 'url', maps_url, website, ''),
    'email', coalesce(email, ''), 'phone', coalesce(phone, ''),
    'description', coalesce(raw ->> 'description', raw ->> 'biography', raw ->> 'snippet', '')
  ),
  raw,
  jsonb_strip_nulls(jsonb_build_object(
    'external_id', google_place_id, 'url', coalesce(raw ->> 'url', maps_url, website),
    'email', email, 'phone', phone
  )),
  md5(raw::text),
  matched_company_id,
  created_at,
  created_at,
  created_at
from ranked
on conflict (collection_id, source_item_key) do nothing;

