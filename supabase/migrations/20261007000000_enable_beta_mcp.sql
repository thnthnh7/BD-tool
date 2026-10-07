-- The Beta plan is invite-only. Enable read-only MCP onboarding for beta
-- workspaces while the platform-level write rollout remains disabled.
update public.plans
set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('mcp_access', true),
    updated_at = now()
where slug = 'beta';
