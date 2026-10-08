-- Keep the recommendation badge exclusive to the Pro plan.
update public.plans
set badge = case when slug = 'pro' then 'Most popular' else '' end,
    updated_at = now()
where slug in ('free', 'starter', 'pro', 'business');
