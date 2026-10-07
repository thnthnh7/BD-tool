import { mcpOAuthScopes } from "@/features/mcp/scopes";
import { appOrigin } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    revocation_endpoint: `${origin}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: mcpOAuthScopes,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
