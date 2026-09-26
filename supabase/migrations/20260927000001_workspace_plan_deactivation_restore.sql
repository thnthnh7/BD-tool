alter table public.workspaces
  add column if not exists plan_status_before_deactivation text;

alter table public.workspaces drop constraint if exists workspaces_plan_status_before_deactivation_check;
alter table public.workspaces
  add constraint workspaces_plan_status_before_deactivation_check
  check (plan_status_before_deactivation is null or plan_status_before_deactivation in ('trialing', 'active', 'past_due', 'expired', 'canceled'));
