# MCP Registry release checklist

The official MCP Registry is still preview infrastructure. Do not publish the temporary Cloudflare tunnel URL.

1. Deploy `/api/mcp` and both OAuth metadata endpoints on Leadely's permanent HTTPS domain.
2. Publish support, privacy, acceptable-use and security-reporting URLs.
3. Choose and verify the reverse-DNS namespace, for example `app.leadely/mcp` only if Leadely controls `leadely.app`.
4. Generate `server.json` with the current official schema using `mcp-publisher init`.
5. Declare the remote transport as `streamable-http` and use the permanent `/api/mcp` URL.
6. Validate OAuth discovery, consent, refresh, revocation, workspace isolation and approval-gated writes against production.
7. Run the official validator, authenticate the publisher through the chosen namespace-verification method, then publish.
8. Add release monitoring for 401/403/429/5xx rates, OAuth registration abuse and write-request failures.
