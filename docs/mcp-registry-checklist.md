# MCP Registry release checklist

The official MCP Registry is still preview infrastructure. Do not publish the temporary Cloudflare tunnel URL.

1. Confirm `/api/mcp` and both OAuth metadata endpoints remain healthy on `https://bizcraw.com`.
2. Privacy, terms, security, contact and acceptable-use pages are published from the marketing application.
3. The manifest uses the Bizcraw-owned namespace `com.bizcraw/bizcraw`; DNS or HTTP ownership verification is still required for the first publication.
4. `server.json` uses the official `2025-12-11` schema and passed `mcp-publisher 1.8.1 validate` on 2026-10-08.
5. Declare the remote transport as `streamable-http` and use the permanent `/api/mcp` URL.
6. Validate OAuth discovery, consent, refresh, revocation, workspace isolation and approval-gated writes against production.
7. Authenticate the publisher through DNS or HTTP namespace verification, publish, then confirm `com.bizcraw/bizcraw` resolves from the production Registry API.
8. Add release monitoring for 401/403/429/5xx rates, OAuth registration abuse and write-request failures.
