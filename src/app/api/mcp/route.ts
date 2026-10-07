import { createMcpHandler, isLegacyRequest } from "@modelcontextprotocol/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpToken } from "@/features/mcp/server/service";
import { createBizcrawMcpServer } from "@/features/mcp/server/mcp-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { admit } from "@/lib/admission";
import { appOrigin, mcpResource } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

function unauthorized(request: Request, message = "Invalid or revoked MCP access token.") {
  const metadata = `${appOrigin(request)}/.well-known/oauth-protected-resource/api/mcp`;
  return Response.json({ error: message }, { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`, "Cache-Control": "no-store" } });
}

async function handle(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return unauthorized(request, "A Bearer token is required.");
  const connection = await authenticateMcpToken(token);
  if (!connection) return unauthorized(request);
  if ("resource" in connection && connection.resource !== mcpResource(request)) return unauthorized(request, "The access token was issued for a different resource.");

  const admin = createAdminClient();
  const [{ data: settings }, { data: workspace }] = await Promise.all([
    admin.from("mcp_settings").select("enabled, read_tools_enabled, write_tools_enabled").eq("id", 1).single(),
    admin.from("workspaces").select("plan_id, plan_status, locked, archived_at").eq("id", connection.workspace_id).maybeSingle(),
  ]);
  if (!settings?.enabled || !settings.read_tools_enabled) return Response.json({ error: "MCP is temporarily unavailable." }, { status: 503 });
  if (!workspace || workspace.locked || workspace.archived_at || ["expired", "canceled"].includes(workspace.plan_status)) return Response.json({ error: "This workspace cannot use MCP." }, { status: 403 });
  const [{ data: plan }, { data: override }] = await Promise.all([
    admin.from("plans").select("features").eq("id", workspace.plan_id).maybeSingle(),
    admin.from("workspace_overrides").select("features").eq("workspace_id", connection.workspace_id).maybeSingle(),
  ]);
  const planFeatures = (plan?.features || {}) as Record<string, unknown>;
  const overrideFeatures = (override?.features || {}) as Record<string, unknown>;
  const mcpEnabled = typeof overrideFeatures.mcp_access === "boolean" ? overrideFeatures.mcp_access : Boolean(planFeatures.mcp_access);
  if (!mcpEnabled) return Response.json({ error: "The workspace plan does not include MCP access." }, { status: 403 });
  const gate = await admit(admin, connection.id, "mcp_request", 120, 60);
  if (!("ok" in gate)) return Response.json({ error: gate.error }, { status: gate.status });

  const factory = () => createBizcrawMcpServer(connection, request.headers.get("x-request-id"), settings.write_tools_enabled);
  if (await isLegacyRequest(request, undefined, { maxRequestBodySize: 256 * 1024 })) {
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true, maxRequestBodySize: 256 * 1024 });
    const server = factory();
    await server.connect(transport);
    return transport.handleRequest(request);
  }
  const handler = createMcpHandler(factory, { legacy: "reject", responseMode: "json", maxRequestBodySize: 256 * 1024 });
  return handler.fetch(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
