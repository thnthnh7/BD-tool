import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase environment variables.");
const admin = createClient(url, key, { auth: { persistSession: false } });
const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id").order("created_at").limit(1).single();
if (workspaceError) throw workspaceError;
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const tokenHash = createHash("sha256").update(token).digest("hex");
const { data: connection, error: insertError } = await admin.from("mcp_connections").insert({
  workspace_id: workspace.id,
  name: "Automated smoke test",
  token_hash: tokenHash,
  token_prefix: `${token.slice(0, 13)}…`,
  scopes: ["workspace:read", "crm:read", "sources:read", "data:read", "knowledge:read", "quotes:read", "scrape:read"],
  expires_at: new Date(Date.now() + 300_000).toISOString(),
}).select("id").single();
if (insertError) throw insertError;

const endpoint = "http://localhost:3000/api/mcp";
async function rpc(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP ${response.status}: ${text}`);
  return JSON.parse(text);
}

try {
  const initialized = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "leadely-smoke", version: "1.0.0" } } });
  const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const workspaceResult = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_workspace", arguments: {} } });
  const companiesResult = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search_companies", arguments: { limit: 1 } } });
  const companiesPage = JSON.parse(companiesResult.result?.content?.[0]?.text || "{}");
  console.log(JSON.stringify({
    initialize: initialized.result?.serverInfo?.name || null,
    protocolVersion: initialized.result?.protocolVersion || null,
    tools: tools.result?.tools?.map((tool) => tool.name) || [],
    getWorkspaceOk: Array.isArray(workspaceResult.result?.content) && workspaceResult.result.content.length > 0,
    paginatedCompanies: Array.isArray(companiesPage.items) && "hasMore" in companiesPage && "nextCursor" in companiesPage,
    structuredContent: Boolean(companiesResult.result?.structuredContent),
  }, null, 2));
} finally {
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
}
