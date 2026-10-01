# MCP operations runbook

## Token or credential exposure

1. Revoke the affected connection from **Platform → MCP** immediately.
2. Revoke its OAuth client when the client identity may also be compromised.
3. Search the tool-call log by connection and request ID, then export the affected window.
4. Rotate `CRON_SECRET`, alert webhook credentials, and Supabase service credentials only when evidence shows those server-side values were exposed.
5. Create a replacement connection with the minimum required scopes. Never restore the old token.

## Bulk revocation

Pause MCP rollout before a broad incident. Export the connection list and audit data, revoke affected connections, then revoke their OAuth clients. Resume read tools first, verify health, and enable write tools only after the incident owner confirms containment.

## Elevated errors or latency

Check **Platform → MCP** for error rate, P50/P95 latency, failed approvals, tool name, workspace, and request ID. Confirm Supabase and application health, inspect the redacted call record, and disable write tools when failures may duplicate external actions. Keep read tools available when isolation and data integrity remain healthy.

## Approval execution failure

Do not create a second request until the first request status is known. Inspect its idempotency key and result. Retry only through the supported MCP retry path. Quote, scrape, and CRM actions must remain workspace-scoped and retain the original audit trail.

## Rollback

Disable write tools, deploy the previous compatible application version, and leave database migrations in place unless a reviewed forward migration removes the new behavior. MCP database migrations are additive. Verify OAuth discovery, token authentication, `tools/list`, a read call, and audit persistence before restoring writes.

## Database or webhook recovery

If audit persistence fails, MCP calls fail closed after three attempts. Restore database write availability before retrying. Failed alert delivery releases its delivery claim so the next cron can retry. Run `/api/mcp/cron` manually with `CRON_SECRET` after recovery and confirm cleanup plus health output.

## Legacy namespace retirement

The `leadely://` resource aliases remain supported through 2026-12-29. Before removal, verify call logs and client documentation no longer reference the old namespace, announce the removal, update the server major version when required, remove aliases, and run contract plus SDK compatibility tests.

## Recovery verification

Run `test:mcp`, `test:mcp:oauth`, `test:mcp:sdk`, `test:mcp:write`, `test:mcp:load`, `test:mcp:contract`, `test:mcp:db-contract`, `test:mcp:access`, and `test:mcp:reliability`. Confirm the production build, migration alignment, rate limiting, workspace isolation, OAuth rotation/revocation, approval concurrency, audit redaction, and alert deduplication.
