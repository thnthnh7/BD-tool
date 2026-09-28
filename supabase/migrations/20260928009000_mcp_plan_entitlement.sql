-- MCP access is configurable per SaaS plan. Preserve existing paid workspaces.
update public.plans
set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('mcp_access', not is_free);
