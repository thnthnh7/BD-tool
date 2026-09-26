alter table public.lead_scrape_jobs
  add column if not exists apify_usage_usd numeric;

comment on column public.lead_scrape_jobs.apify_usage_usd is
  'Final Apify usage charged for this actor run, in USD.';
