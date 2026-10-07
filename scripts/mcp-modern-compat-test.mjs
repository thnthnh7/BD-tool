import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpTestWorkspace } from "./mcp-test-fixture.mjs";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixture = await createMcpTestWorkspace(admin);
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const { data: connection, error } = await admin.from("mcp_connections").insert({
  workspace_id: fixture.workspace.id,
  name: "MCP 2026 compatibility test",
  token_hash: createHash("sha256").update(token).digest("hex"),
  token_prefix: `${token.slice(0, 13)}…`,
  scopes: ["workspace:read", "crm:read"],
  expires_at: new Date(Date.now() + 300_000).toISOString(),
}).select("id").single();
if (error) throw error;

const client = new Client(
  { name: "bizcraw-modern-compat", version: "1.0.0" },
  { capabilities: {}, versionNegotiation: { mode: { pin: "2026-07-28" } } },
);
const transport = new StreamableHTTPClientTransport(
  new URL(`${process.env.MCP_TEST_BASE_URL || "http://localhost:3000"}/api/mcp`),
  { authProvider: { token: async () => token } },
);

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const workspace = await client.callTool({ name: "get_workspace", arguments: {} });
  console.log(JSON.stringify({
    connected: true,
    era: client.getProtocolEra(),
    protocolVersion: client.getNegotiatedProtocolVersion(),
    toolCount: tools.tools.length,
    securitySchemesAdvertised: tools.tools.every((tool) => Array.isArray(tool._meta?.securitySchemes)),
    workspaceReadable: !workspace.isError,
  }, null, 2));
} finally {
  await client.close().catch(() => undefined);
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
  await fixture.cleanup();
}
