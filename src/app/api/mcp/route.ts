import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpToken } from "@/features/mcp/server/service";
import { createLeadelyMcpServer } from "@/features/mcp/server/mcp-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { admit } from "@/lib/admission";
import { appOrigin, mcpResource } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

function unauthorized(request: Request, message = "Invalid or revoked MCP access token.") {
  const metadata = `${appOrigin(request)}/.well-known/oauth-protected-resource/api/mcp`;
  return Response.json({ error: message }, { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadata}"` } });
}

async function handle(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return unauthorized(request, "A Bearer token is required.");
  const connection = await authenticateMcpToken(token);
  if (!connection) return unauthorized(request);
  if ("resource" in connection && connection.resource !== mcpResource(request)) return unauthorized(request, "The access token was issued for a different resource.");

  const admin = createAdminClient();
  const { data: settings } = await admin.from("mcp_settings").select("enabled, read_tools_enabled, write_tools_enabled").eq("id", 1).single();
  if (!settings?.enabled || !settings.read_tools_enabled) return Response.json({ error: "MCP is temporarily unavailable." }, { status: 503 });
  const gate = await admit(admin, connection.id, "mcp_request", 120, 60);
  if (!("ok" in gate)) return Response.json({ error: gate.error }, { status: gate.status });

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true, maxRequestBodySize: 256 * 1024 });
  const server = createLeadelyMcpServer(connection, request.headers.get("x-request-id"), settings.write_tools_enabled);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
