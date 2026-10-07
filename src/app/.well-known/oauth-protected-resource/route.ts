import { mcpOAuthScopes } from "@/features/mcp/scopes";
import { appOrigin, mcpResource } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return Response.json({ resource: mcpResource(request), authorization_servers: [appOrigin(request)], scopes_supported: mcpOAuthScopes, resource_name: "Bizcraw MCP" }, { headers: { "Cache-Control": "public, max-age=300" } });
}
