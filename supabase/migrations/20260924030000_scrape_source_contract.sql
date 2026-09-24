alter table public.scrape_sources
  add column if not exists input_schema jsonb,
  add column if not exists example_input jsonb,
  add column if not exists output_schema jsonb,
  add column if not exists schema_fetched_at timestamptz;
