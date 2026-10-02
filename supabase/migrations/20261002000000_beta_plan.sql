-- Give invited beta users access to the core product without requiring a
-- payment provider or putting their workspace into a trial/past-due state.
insert into public.plans (
  slot,
  name,
  slug,
  is_public,
  is_free,
  price_monthly,
  price_yearly,
  trial_days,
  quotas,
  features,
  sort_order,
  badge
)
values (
  5,
  'Beta',
  'beta',
  true,
  true,
  0,
  0,
  0,
  '{"seats":5,"quotes_per_month":100,"ai_briefs_per_month":20,"maps_scrapes_per_month":25,"maps_places_per_month":2000,"maps_people_per_month":2000}'::jsonb,
  '{"byok_ai":true,"contracts":true,"mcp_access":false,"export_docx":true,"lead_scrape":true,"google_drive":true,"custom_branding":false,"share_no_watermark":false}'::jsonb,
  0,
  'Beta'
)
on conflict (slug) do update set
  name = excluded.name,
  is_public = excluded.is_public,
  is_free = excluded.is_free,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  trial_days = excluded.trial_days,
  quotas = excluded.quotas,
  features = excluded.features,
  sort_order = excluded.sort_order,
  badge = excluded.badge,
  updated_at = now();
