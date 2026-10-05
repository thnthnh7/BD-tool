-- Introduce sidebar-wide plan modules without removing access from existing plans.
update public.plans
set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
  'sources', true,
  'scraping', coalesce((features->>'scraping')::boolean, (features->>'lead_scrape')::boolean, true),
  'data_library', true,
  'leads', true,
  'lists', true,
  'companies', true,
  'contacts', true,
  'deals', true,
  'tasks', true,
  'quotes', true,
  'product_modules', true,
  'inbox', true,
  'calendar', true,
  'sequences', true,
  'team', true,
  'crm_integrations', true,
  'ai_agent', true
);

-- Provider states must not be collapsed into active access.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending', 'trialing', 'active', 'past_due', 'suspended', 'expired', 'canceled'));

alter table public.workspaces drop constraint if exists workspaces_plan_status_check;
alter table public.workspaces
  add constraint workspaces_plan_status_check
  check (plan_status in ('pending', 'trialing', 'active', 'past_due', 'suspended', 'expired', 'canceled'));
