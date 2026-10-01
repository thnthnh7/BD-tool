import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpTestWorkspace } from "./mcp-test-fixture.mjs";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixture = await createMcpTestWorkspace(admin);
const workspace = fixture.workspace;
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspace.id, name: "MCP SDK compatibility test", token_hash: createHash("sha256").update(token).digest("hex"), token_prefix: `${token.slice(0, 13)}…`, scopes: ["workspace:read", "crm:read"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
if (connectionError) throw connectionError;

const client = new Client({ name: "bizcraw-sdk-compat", version: "1.0.0" }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(`${process.env.MCP_TEST_BASE_URL || "http://localhost:3000"}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
try {
  await client.connect(transport);
  const [tools, resources, prompts] = await Promise.all([client.listTools(), client.listResources(), client.listPrompts()]);
  const workspaceResource = resources.resources.find((item) => item.name === "workspace-profile");
  if (!workspaceResource) throw new Error("Workspace resource was not advertised.");
  const capabilitiesResource = resources.resources.find((item) => item.name === "server-capabilities");
  if (!capabilitiesResource) throw new Error("Server capabilities resource was not advertised.");
  if (!tools.tools.some((item) => item.name === "get_server_capabilities")) throw new Error("Server capabilities tool was not advertised.");
  const legacyWorkspaceResource = resources.resources.find((item) => item.name === "workspace-profile-legacy");
  const legacySchemaResource = resources.resources.find((item) => item.name === "crm-schema-legacy");
  if (!legacyWorkspaceResource || !legacySchemaResource) throw new Error("Legacy URI aliases were not advertised during the deprecation window.");
  if (!workspaceResource.uri.startsWith("bizcraw://") || !legacyWorkspaceResource.uri.startsWith("leadely://")) throw new Error("Resource namespace migration is invalid.");
  const resource = await client.readResource({ uri: workspaceResource.uri });
  const capabilities = await client.readResource({ uri: capabilitiesResource.uri });
  const legacyResource = await client.readResource({ uri: legacyWorkspaceResource.uri });
  const prompt = await client.getPrompt({ name: "research-prospect", arguments: { companyName: "Example Company" } });
  console.log(JSON.stringify({ connected: true, toolCount: tools.tools.length, resources: resources.resources.map((item) => item.name), prompts: prompts.prompts.map((item) => item.name), resourceReadable: resource.contents.length > 0, legacyResourceReadable: legacyResource.contents.length > 0, capabilitiesReadable: capabilities.contents.length > 0, promptRendered: prompt.messages.length > 0 }, null, 2));
} finally {
  await client.close().catch(() => undefined);
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
  await fixture.cleanup();
}
