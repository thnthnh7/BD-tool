# Leadely MCP

Leadely exposes a workspace-scoped MCP server over Streamable HTTP at `/api/mcp`.

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
| `list_scrape_sources` | `sources:read` | Installed scrape sources |
| `search_data_library` | `data:read` | Search normalized scraped records |
| `search_knowledge` | `knowledge:read` | Search document evidence excerpts |
| `get_quotes` | `quotes:read` | Read recent quotes or one quote |
| `list_scrape_runs` | `scrape:read` | Read scrape status, counts, cost and runner |
| `create_company` | `crm:write` | Create a company after confirmation in the MCP client; retries use an idempotency key |
| `create_contact` | `crm:write` | Create a contact and optionally link it to a workspace company |
| `create_lead` | `crm:write` | Create a lead linked to workspace CRM records |
| `create_task` | `crm:write` | Create and assign a CRM task to the connected user |
| `create_deal` | `crm:write` | Create a deal in the default or selected sales pipeline |
| `update_company` | `crm:write` | Update selected company fields |
| `update_contact` | `crm:write` | Update selected contact fields |
| `update_lead` | `crm:write` | Update lead status, score and next action |
| `update_deal` | `crm:write` | Update selected deal fields |
| `request_start_maps_scrape` | `scrape:write` | Queue a Google Maps scrape request for human approval |
| `get_action_request` | `workspace:read` | Poll approval and execution status |

All queries are restricted to the token's workspace. Each tool call is audited with sensitive input values redacted, and each connection is rate limited. Safe additive writes such as company creation run directly after the MCP client confirms them and require an idempotency key. Paid actions such as scrape runs require an owner or admin to approve the request in **Workspace → MCP** within 30 minutes. Scrape approval uses the existing plan, quota, Apify connection and webhook checks. Rotate a token when moving the connection to another client, and revoke it immediately when a client or device is no longer trusted. Rotation invalidates the old token immediately and issues a new 90-day token.

## OAuth 2.1 client connection

Remote MCP clients can discover Leadely OAuth from `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`. Leadely supports public clients, dynamic client registration, authorization code with PKCE S256, rotating refresh tokens, and RFC 7009 revocation. Access tokens are opaque, stored only as SHA-256 hashes, expire after one hour, and are bound to the `/api/mcp` resource.

Personal access tokens remain available for clients that support static Bearer headers. OAuth is preferred for end-user clients because users approve scopes in Leadely and can revoke the resulting connection without copying a secret.

## Operations

Call `GET /api/mcp/cron` on a daily schedule with `Authorization: Bearer <CRON_SECRET>`. It expires pending approvals and removes expired OAuth codes, old revoked tokens, unused registered clients, audit rows older than 90 days, and idempotency records older than 30 days. Super Admin can inspect 24-hour call volume, error count, P50/P95 latency, and approval failures from **Platform → MCP**.

## Current boundary

The current release exposes read tools, direct idempotent company creation, and approval-gated Google Maps scrape requests through personal access tokens and OAuth 2.1. Super Admin can pause read/write rollout and revoke registered OAuth clients. Marketplace publication still requires a stable production HTTPS hostname, public support/privacy URLs, namespace ownership verification, and a validated `server.json` before running `mcp-publisher publish`.
