alter table public.scrape_sources
  add column if not exists pricing_info jsonb;

comment on column public.scrape_sources.pricing_info is
  'Latest Apify currentPricingInfo snapshot, refreshed by catalog sync.';
