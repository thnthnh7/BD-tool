# MCP production backlog

This file tracks the remaining MCP work that cannot be completed entirely in the local codebase. The internal MCP implementation, security gates, audit logging, approval flows, localization, automated tests, operational runbook and production build are already complete.

## 1. Permanent production domain and HTTPS

**Status:** implemented at `https://bizcraw.com`.

- `/api/mcp` is deployed on the permanent HTTPS hostname.
- Both OAuth discovery endpoints are exposed on the same public origin.
- The production metadata binds OAuth to `https://bizcraw.com/api/mcp`.
- Dynamic client registration, authorization-code exchange and refresh have passed production smoke tests.

**Done when:** OAuth discovery, authorization, token exchange, refresh, revocation and an MCP initialize request succeed against the permanent domain.

## 2. Production secrets and scheduled maintenance

**Blocked by:** the production hosting and scheduler.

- Create a strong production `CRON_SECRET` in the hosting secret manager.
- Schedule authenticated calls to `/api/mcp/cron` at least daily.
- Configure `MCP_ALERT_COOLDOWN_MINUTES` for the production incident policy.
- Confirm cleanup removes expired approvals, OAuth codes/tokens, stale clients, old audit rows and idempotency records.

**Done when:** the scheduler reports successful cleanup and health results for seven consecutive runs without exposing the secret in logs.

## 3. Production monitoring and alert delivery

**Blocked by:** the chosen monitoring, Slack, Teams or incident-management service.

- Create the production webhook destination and set `MCP_ALERT_WEBHOOK_URL`.
- Route alerts to an owned incident channel with an on-call contact.
- Monitor 401, 403, 429 and 5xx rates, P50/P95/P99 latency, failed approvals, audit-persistence failures and OAuth registration abuse.
- Test alert delivery, fingerprint deduplication, cooldown and recovery notification behavior.

**Done when:** a controlled failure creates one actionable alert, duplicate cron executions do not spam the channel, and the incident links back to the relevant MCP audit data.

## 4. Real MCP client compatibility

**Blocked by:** access to the target MCP clients and their production OAuth configuration.

- Test Streamable HTTP and OAuth with the supported versions of Claude, ChatGPT/Codex and any other launch client.
- Confirm the `2025-11-25` compatibility path and `2026-07-28` modern path against the release candidate. Both paths are covered by automated SDK tests.
- Verify tool, resource and prompt discovery.
- Verify consent, scope display, token refresh, reconnect and user-initiated revocation.
- Record client-specific configuration and known limitations in the public documentation.

**Done when:** every launch client passes initialize, discovery, read, approved write, refresh and revoke scenarios using a normal user account.

## 5. External CRM provider executors

**Blocked by:** developer applications, sandbox tenants, client IDs/secrets and API approval from each provider.

- Complete and certify export/bidirectional synchronization for HubSpot.
- Implement provider executors for the CRM platforms selected for launch.
- Validate field mapping, pagination, webhook verification, rate limits, backoff, deletion semantics, conflict handling and per-record retry against each sandbox.
- Document required scopes and provider review requirements.

**Done when:** each advertised provider passes sandbox import/export, reconnect, rate-limit, conflict, retry and workspace-isolation tests. Do not advertise a provider before its executor passes these checks.

## 6. Production security assessment

**Blocked by:** a deployed production-like environment and an approved security-testing window.

- Run a secrets/configuration review against the actual deployment.
- Test token abuse, OAuth replay, redirect manipulation, dynamic registration abuse, oversized requests, rate-limit bypass and cross-workspace access.
- Review service-role access, production logs, backups and incident permissions.
- Remediate findings and rerun the affected MCP contract/security tests.

**Done when:** no unresolved critical/high finding remains and accepted lower-risk findings have an owner and due date.

## 7. Soak, capacity and regional performance testing

**Blocked by:** production-like compute, database sizing and deployment region.

- Run sustained load for several hours with realistic read/write ratios and multiple workspaces.
- Measure P50/P95/P99 latency, error rate, database connections, CPU/memory and audit-table growth.
- Test behavior during Supabase throttling, transient network failures and application restarts.
- Set initial production rate limits and capacity alarms from measured results.

**Done when:** the agreed concurrency target is sustained without data leakage, duplicate writes or unbounded latency, and capacity thresholds are documented.

## 8. MCP Registry publication

**Blocked by:** permanent domain ownership and public legal/support pages.

- Publish support, privacy, acceptable-use and security-reporting URLs.
- Choose and verify a Bizcraw-owned reverse-DNS namespace.
- Generate `server.json` with the current official schema and permanent Streamable HTTP endpoint.
- Run the official validator and publish with `mcp-publisher`.
- Monitor the published listing and repeat validation for material contract releases.

**Done when:** the Registry accepts the server, namespace verification succeeds, the public listing resolves to the production endpoint and a clean client can connect from the listing.

## 9. Legacy namespace retirement

**Target date:** after 2026-12-29.

- Confirm audit/client documentation no longer uses `leadely://` resources.
- Announce removal before the deadline.
- Remove the legacy workspace-profile and CRM-schema aliases.
- Update the MCP contract version when required and rerun contract plus SDK compatibility tests.

**Done when:** only `bizcraw://` resources are advertised and supported clients pass without the legacy aliases.

## Production launch gate

Before enabling MCP broadly, all items 1–8 must be complete, staging migrations must match production, and the following commands must pass against the release candidate:

```text
npm run lint
npm run i18n:check
npm run test:mcp
npm run test:mcp:oauth
npm run test:mcp:sdk
npm run test:mcp:modern
npm run test:mcp:write
npm run test:mcp:load
npm run test:mcp:contract
npm run test:mcp:db-contract
npm run test:mcp:access
npm run test:mcp:reliability
npm run build
```

Use [`mcp-operations-runbook.md`](./mcp-operations-runbook.md) for incident and recovery procedures and [`mcp-registry-checklist.md`](./mcp-registry-checklist.md) for the publication sequence.
