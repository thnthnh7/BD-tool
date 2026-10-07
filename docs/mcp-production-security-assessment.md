# MCP production security assessment

Assessment target: `https://bizcraw.com/api/mcp`

## Automated production-safe checks

Run `npm run test:mcp:production-security`. The script creates isolated temporary workspaces and connections, performs only read operations through MCP, and deletes the fixtures afterward. It verifies:

- OAuth protected-resource metadata is bound to the production MCP resource.
- Anonymous and random Bearer tokens are rejected.
- Unsafe redirect URI registration is rejected.
- Tool discovery respects the granted scopes.
- A valid token cannot read a CRM record from another workspace.
- Requests larger than the configured body limit are rejected.
- Expired and revoked personal access tokens are rejected.
- Authentication failures include `Cache-Control: no-store`.

Run the existing production OAuth smoke test with both `MCP_TEST_BASE_URL` and `MCP_TEST_RESOURCE_URL` set to `https://bizcraw.com`. It verifies PKCE, redirect matching, authorization-code replay rejection, refresh rotation and replay rejection, OAuth client revocation, access-token revocation and token resource binding.

## Manual deployment review

- Confirm production secrets are scoped to Production and are not exposed through client bundles or logs.
- Confirm `CRON_SECRET`, `WORKSPACE_SECRETS_KEY` and Supabase service credentials are rotated after any suspected exposure.
- Confirm the MCP audit log redacts tokens, authorization headers, API keys and provider credentials.
- Review 401, 403, 429 and 5xx rates after each rollout.
- Test alert delivery after configuring `MCP_ALERT_WEBHOOK_URL`.
- Keep write tools disabled until a controlled approval, idempotency and rollback exercise passes with a normal production account.

## Launch criterion

Do not broaden the rollout while a Critical or High finding remains unresolved. Record each finding with severity, affected endpoint or tool, reproduction steps, evidence, remediation owner and retest result.

The 2026-10-08 runtime dependency review found no Critical or High production dependency advisories after updating the MCP compatibility SDK, Sharp and source-map parser. Five Moderate transitive advisories remain in the DOCX/XLSX dependency trees (`argparse`, `sprintf-js` and `uuid`). Their upstream fixes currently require breaking dependency changes; they remain restricted to document processing paths and must be reviewed again before the next document-library upgrade.
