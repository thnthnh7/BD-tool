# Bizcraw MCP

Bizcraw exposes a workspace-scoped MCP server over Streamable HTTP at `/api/mcp`. Access is controlled by the workspace SaaS plan through the `mcp_access` entitlement; Super Admin can configure it per plan or enable it for a specific workspace override.

## Connect

MCP is available to invited Beta workspaces and paid plans while the rollout is controlled by the platform MCP switch. Read tools can be enabled independently from write tools.

1. A workspace owner or admin opens **Workspace → MCP**.
2. Choose the target client in the setup guide.
3. For ChatGPT, add `https://bizcraw.com/api/mcp` as a custom MCP app and complete the Bizcraw OAuth consent flow.
4. For clients that use a static token, select the minimum scopes, create a connection and copy the token immediately. Bizcraw stores only its SHA-256 hash.
5. Run the verification prompt shown in the setup guide. A successful call updates the connection's **Last used** time.

New connections default to `workspace:read` and `crm:read`. Write scopes are never selected automatically.

```json
{
  "mcpServers": {
    "bizcraw": {
      "type": "http",
      "url": "https://your-bizcraw-host/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}
```

## Available tools

| Tool | Scope | Purpose |
| --- | --- | --- |
| `get_workspace` | `workspace:read` | Workspace and subscription profile |
| `get_server_capabilities` | `workspace:read` | Server version, tool-schema version, compatibility policy and deprecations |
| `search_companies` | `crm:read` | Search CRM companies |
| `search_contacts` | `crm:read` | Search CRM contacts |
| `list_leads` | `crm:read` | List recent leads |
| `get_company` | `crm:read` | Read one company by ID |
| `get_contact` | `crm:read` | Read one contact by ID |
| `get_lead` | `crm:read` | Read one lead by ID |
| `get_deal` | `crm:read` | Read one deal by ID |
| `get_task` | `crm:read` | Read one task by ID |
| `list_sales_pipelines` | `crm:read` | List sales pipelines and their stages |
| `list_crm_integrations` | `crm:read` | Read connection and synchronization status without exposing credentials |
| `list_crm_sync_runs` | `crm:read` | Read paginated CRM synchronization history and processing totals |
| `get_crm_sync_run` | `crm:read` | Read one synchronization run in the token workspace |
| `list_crm_field_mappings` | `crm:read` | Inspect field mappings for one CRM connection |
| `list_crm_sync_issues` | `crm:read` | Read unresolved record conflicts and synchronization errors |
| `list_crm_record_failures` | `crm:read` | Inspect record-level synchronization failures and retry state |
| `get_crm_sync_readiness` | `crm:read` | Check authorization, object selection and mapping readiness |
| `list_lead_lists` | `crm:read` | List workspace lead lists |
| `get_list` | `crm:read` | Read one lead list with up to 50 memberships |
| `list_scrape_sources` | `sources:read` | Installed scrape sources |
| `search_data_library` | `data:read` | Search normalized scraped records |
| `get_data_record` | `data:read` | Read one normalized record with bounded payload size |
| `search_knowledge` | `knowledge:read` | Hybrid semantic and keyword search with source and relevance score |
| `get_quotes` | `quotes:read` | Read recent quotes or one quote |
| `list_scrape_runs` | `scrape:read` | Read scrape status, counts, cost and runner |
| `get_scrape_run` | `scrape:read` | Read one scrape run by ID |
| `create_company` | `crm:write` | Create a company after confirmation in the MCP client; retries use an idempotency key |
| `create_contact` | `crm:write` | Create a contact and optionally link it to a workspace company |
| `create_lead` | `crm:write` | Create a lead linked to workspace CRM records |
| `create_task` | `crm:write` | Create and assign a CRM task to the connected user |
| `create_deal` | `crm:write` | Create a deal in the default or selected sales pipeline |
| `update_company` | `crm:write` | Update selected company fields |
| `update_contact` | `crm:write` | Update selected contact fields |
| `update_lead` | `crm:write` | Update lead status, score and next action |
| `update_deal` | `crm:write` | Update selected deal fields |
| `add_company_to_list` | `crm:write` | Add a company and optional lead/contact context to a list |
| `create_list` | `crm:write` | Create a workspace lead list |
| `remove_company_from_list` | `crm:write` | Remove a company membership from a list |
| `update_task` | `crm:write` | Update task details, priority, status and due date |
| `create_quote_draft` | `quotes:write` | Create a draft quote for human review without sending it |
| `request_mark_quote_sent` | `quotes:write` | Request owner or admin approval before marking a draft quote as sent |
| `request_start_maps_scrape` | `scrape:write` | Queue a Google Maps scrape request for human approval |
| `request_start_crm_sync` | `crm:write` | Request approval for an asynchronous HubSpot company/contact/deal import |
| `cancel_crm_sync` | `crm:write` | Cancel a queued run or safely stop a running job after its current page |
| `retry_crm_sync` | `crm:write` | Requeue a stopped or failed run from its saved cursor |
| `resolve_crm_sync_issue` | `crm:write` | Resolve a record conflict by keeping Bizcraw data or re-importing the provider version |
| `retry_crm_record_failure` | `crm:write` | Retry one failed provider record without rerunning the full object collection |
| `get_action_request` | `workspace:read` | Poll approval and execution status |

Bizcraw also advertises a workspace profile resource, a CRM schema resource, and reusable prompts for prospect research and sales follow-up. These are scope-aware and only appear when the connection has the required read permission. List responses are paginated, large structured fields are bounded, and detail tools always apply the token workspace filter.

All queries are restricted to the token's workspace. Every request rechecks the current plan entitlement, subscription status and workspace lock/archive state, so an existing token stops working when access is removed. Each tool call is audited with sensitive input values redacted, and each connection is rate limited. Safe additive writes such as company creation run directly after the MCP client confirms them and require an idempotency key. Externally meaningful actions such as marking a quote as sent, and paid actions such as scrape runs, require an owner or admin to approve the request in **Workspace → MCP** within 30 minutes. Scrape approval uses the existing plan, quota, Apify connection and webhook checks. Rotate a token when moving the connection to another client, and revoke it immediately when a client or device is no longer trusted. Rotation invalidates the old token immediately and issues a new 90-day token.

## OAuth 2.1 client connection

Remote MCP clients can discover Bizcraw OAuth from `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`. Bizcraw supports public clients, dynamic client registration, authorization code with PKCE S256, rotating refresh tokens, `offline_access`, and RFC 7009 revocation. Access tokens are opaque, stored only as SHA-256 hashes, expire after one hour, and are bound to the `/api/mcp` resource.

Personal access tokens remain available for clients that support static Bearer headers. OAuth is preferred for end-user clients because users approve scopes in Bizcraw and can revoke the resulting connection without copying a secret.

## Versioning and compatibility

The endpoint accepts both the established `2025-11-25` Streamable HTTP protocol and the current `2026-07-28` protocol. Modern clients receive per-tool OAuth security-scheme metadata; compatibility tests pin both protocol generations in CI. Clients can read the `server-capabilities` resource or call `get_server_capabilities`. Additive tools and optional fields may be released within the current major server version. Renaming or removing a tool, changing a required input, or changing response meaning requires a new major server version. Deprecations are announced in the capabilities payload for at least 90 days before removal. CI validates version syntax, schema ordering and deprecation metadata on every change.

Resource URIs use the `bizcraw://` namespace. The previous `leadely://` workspace-profile and CRM-schema URIs remain available as legacy aliases until 2026-12-29 so existing clients can migrate without downtime.

## Operations

Call `GET /api/mcp/cron` on a daily schedule with `Authorization: Bearer <CRON_SECRET>`. It expires pending approvals and removes expired OAuth codes, old revoked tokens, unused registered clients, audit rows older than 90 days, and idempotency records older than 30 days. When `MCP_ALERT_WEBHOOK_URL` is configured, the same run sends a provider-neutral JSON alert for elevated hourly error rate, P95 latency or failed approvals. Quote lifecycle approvals are executed atomically with a database row lock and require the reviewer to remain an Owner or Admin. Super Admin can inspect 24-hour call volume, error count, P50/P95 latency and approval failures from **Platform → MCP**. The same screen provides a paginated and searchable tool-call log, redacted request details, filtered CSV export, identifies OAuth and personal-token connections, shows token expiry, and lets Super Admin revoke a connection together with its active OAuth tokens.

Audit writes retry three times and fail the tool response if the audit record cannot be persisted. Health alerts use a fingerprint and a configurable cooldown (`MCP_ALERT_COOLDOWN_MINUTES`, 60 minutes by default) to avoid repeating the same incident notification. Staging tests use temporary workspaces and users that are deleted after every run; they cover scope isolation, workspace boundaries, rollout gates, token expiry/revocation, OAuth replay protection, database concurrency, write idempotency and rate limiting.

Operational incident, revocation, rollback, recovery and legacy-namespace procedures are documented in [`docs/mcp-operations-runbook.md`](./mcp-operations-runbook.md).

Work that requires the production domain, hosted infrastructure or third-party platforms is tracked in [`docs/mcp-production-backlog.md`](./mcp-production-backlog.md).

## Current boundary

The current release exposes workspace, CRM, pipeline, integration, synchronization history, field-mapping, conflict, list, source, data-library, knowledge, quote and scrape reads. It supports idempotent company, contact, lead, task, deal, list and quote-draft writes, constrained CRM updates, and approval-gated quote delivery, Google Maps scrape requests and HubSpot imports through personal access tokens and OAuth 2.1. HubSpot synchronization imports companies, contacts and associated deals in durable, paginated background runs. Deal imports require the associated company to be imported first and use the workspace default sales pipeline. Exports and additional providers remain staged behind their provider executors. Super Admin can pause read/write rollout, inspect tool activity, revoke connections and revoke registered OAuth clients. Marketplace publication still requires a stable production HTTPS hostname, public support/privacy URLs, namespace ownership verification, and a validated `server.json` before running `mcp-publisher publish`.
