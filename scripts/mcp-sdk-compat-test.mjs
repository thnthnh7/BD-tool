import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id").order("created_at").limit(1).single();
if (workspaceError) throw workspaceError;
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspace.id, name: "MCP SDK compatibility test", token_hash: createHash("sha256").update(token).digest("hex"), token_prefix: `${token.slice(0, 13)}…`, scopes: ["workspace:read", "crm:read"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
if (connectionError) throw connectionError;

const client = new Client({ name: "leadely-sdk-compat", version: "1.0.0" }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(`${process.env.MCP_TEST_BASE_URL || "http://localhost:3000"}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
try {
  await client.connect(transport);
  const [tools, resources, prompts] = await Promise.all([client.listTools(), client.listResources(), client.listPrompts()]);
  const workspaceResource = resources.resources.find((item) => item.name === "workspace-profile");
  if (!workspaceResource) throw new Error("Workspace resource was not advertised.");
  const resource = await client.readResource({ uri: workspaceResource.uri });
  const prompt = await client.getPrompt({ name: "research-prospect", arguments: { companyName: "Example Company" } });
  console.log(JSON.stringify({ connected: true, toolCount: tools.tools.length, resources: resources.resources.map((item) => item.name), prompts: prompts.prompts.map((item) => item.name), resourceReadable: resource.contents.length > 0, promptRendered: prompt.messages.length > 0 }, null, 2));
} finally {
  await client.close().catch(() => undefined);
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
}
