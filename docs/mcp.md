# Leadely MCP

Leadely exposes a workspace-scoped MCP server over Streamable HTTP at `/api/mcp`. Access is controlled by the workspace SaaS plan through the `mcp_access` entitlement; Super Admin can configure it per plan or enable it for a specific workspace override.

## Connect

1. A workspace owner or admin opens **Workspace → MCP**.
2. Select the minimum scopes required by the AI client.
3. Create a token and copy it immediately. Leadely stores only its SHA-256 hash.
4. Configure the client with the MCP endpoint and an `Authorization: Bearer <token>` header.

```json
{
  "mcpServers": {
    "leadely": {
      "type": "http",
      "url": "https://your-leadely-host/api/mcp",
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
| `get_action_request` | `workspace:read` | Poll approval and execution status |

Leadely also advertises a workspace profile resource, a CRM schema resource, and reusable prompts for prospect research and sales follow-up. These are scope-aware and only appear when the connection has the required read permission. List responses are paginated, large structured fields are bounded, and detail tools always apply the token workspace filter.

All queries are restricted to the token's workspace. Every request rechecks the current plan entitlement, subscription status and workspace lock/archive state, so an existing token stops working when access is removed. Each tool call is audited with sensitive input values redacted, and each connection is rate limited. Safe additive writes such as company creation run directly after the MCP client confirms them and require an idempotency key. Externally meaningful actions such as marking a quote as sent, and paid actions such as scrape runs, require an owner or admin to approve the request in **Workspace → MCP** within 30 minutes. Scrape approval uses the existing plan, quota, Apify connection and webhook checks. Rotate a token when moving the connection to another client, and revoke it immediately when a client or device is no longer trusted. Rotation invalidates the old token immediately and issues a new 90-day token.

## OAuth 2.1 client connection

Remote MCP clients can discover Leadely OAuth from `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`. Leadely supports public clients, dynamic client registration, authorization code with PKCE S256, rotating refresh tokens, and RFC 7009 revocation. Access tokens are opaque, stored only as SHA-256 hashes, expire after one hour, and are bound to the `/api/mcp` resource.

Personal access tokens remain available for clients that support static Bearer headers. OAuth is preferred for end-user clients because users approve scopes in Leadely and can revoke the resulting connection without copying a secret.

## Operations

Call `GET /api/mcp/cron` on a daily schedule with `Authorization: Bearer <CRON_SECRET>`. It expires pending approvals and removes expired OAuth codes, old revoked tokens, unused registered clients, audit rows older than 90 days, and idempotency records older than 30 days. When `MCP_ALERT_WEBHOOK_URL` is configured, the same run sends a provider-neutral JSON alert for elevated hourly error rate, P95 latency or failed approvals. Quote lifecycle approvals are executed atomically with a database row lock and require the reviewer to remain an Owner or Admin. Super Admin can inspect 24-hour call volume, error count, P50/P95 latency and approval failures from **Platform → MCP**. The same screen provides a paginated and searchable tool-call log, redacted request details, filtered CSV export, identifies OAuth and personal-token connections, shows token expiry, and lets Super Admin revoke a connection together with its active OAuth tokens.

## Current boundary

The current release exposes workspace, CRM, pipeline, integration, synchronization history, field-mapping, conflict, list, source, data-library, knowledge, quote and scrape reads. It supports idempotent company, contact, lead, task, deal, list and quote-draft writes, constrained CRM updates, and approval-gated quote delivery and Google Maps scrape requests through personal access tokens and OAuth 2.1. CRM provider execution is intentionally not exposed as an MCP action until provider-specific workers can execute and reconcile queued runs; the readiness tool reports blockers instead of creating a run that cannot finish. Super Admin can pause read/write rollout, inspect tool activity, revoke connections and revoke registered OAuth clients. Marketplace publication still requires a stable production HTTPS hostname, public support/privacy URLs, namespace ownership verification, and a validated `server.json` before running `mcp-publisher publish`.
