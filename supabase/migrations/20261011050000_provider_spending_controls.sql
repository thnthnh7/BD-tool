create table if not exists public.workspace_provider_budgets (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  monthly_limit_usd numeric check (monthly_limit_usd is null or monthly_limit_usd >= 0),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);

alter table public.workspace_provider_budgets enable row level security;
create policy workspace_provider_budgets_select on public.workspace_provider_budgets
  for select using (workspace_id = public.current_workspace_id() or public.is_platform_admin());
create policy workspace_provider_budgets_manage on public.workspace_provider_budgets
  for all using (workspace_id = public.current_workspace_id() and public.current_member_role() in ('owner', 'admin'))
  with check (workspace_id = public.current_workspace_id() and public.current_member_role() in ('owner', 'admin'));

create or replace function public.enforce_provider_spending_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  spending_limit numeric;
  used_this_month numeric;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select monthly_limit_usd into spending_limit
  from public.workspace_provider_budgets
  where workspace_id = new.workspace_id and provider = 'apify';
  if spending_limit is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text || ':apify-budget', 0));
  select coalesce(sum(greatest(coalesce(apify_usage_usd, 0), 0)), 0) into used_this_month
  from public.lead_scrape_jobs
  where workspace_id = new.workspace_id
    and created_at >= date_trunc('month', now());
  if used_this_month >= spending_limit then raise exception 'provider_spending_limit_reached'; end if;
  return new;
end;
$$;

drop trigger if exists lead_scrape_jobs_provider_budget on public.lead_scrape_jobs;
create trigger lead_scrape_jobs_provider_budget
before insert on public.lead_scrape_jobs
for each row execute function public.enforce_provider_spending_limit();
