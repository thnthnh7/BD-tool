import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.MCP_TEST_BASE_URL || "http://localhost:3000";
const requestCount = Math.max(121, Number(process.env.MCP_LOAD_REQUESTS || 130));
const concurrency = Math.max(1, Math.min(40, Number(process.env.MCP_LOAD_CONCURRENCY || 20)));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id").order("created_at").limit(1).single();
if (workspaceError) throw workspaceError;
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspace.id, name: "MCP load test", token_hash: createHash("sha256").update(token).digest("hex"), token_prefix: `${token.slice(0, 13)}…`, scopes: ["workspace:read"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
if (connectionError) throw connectionError;

const durations = [];
const statuses = new Map();
let cursor = 0;
async function worker() {
  while (cursor < requestCount) {
    const index = cursor++;
    const started = performance.now();
    const response = await fetch(`${baseUrl}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: index + 1, method: "tools/call", params: { name: "get_workspace", arguments: {} } }) });
    durations.push(performance.now() - started);
    statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
    await response.arrayBuffer();
  }
}

try {
  await Promise.all(Array.from({ length: concurrency }, worker));
  durations.sort((a, b) => a - b);
  const percentile = (ratio) => Math.round(durations[Math.min(durations.length - 1, Math.ceil(durations.length * ratio) - 1)] || 0);
  const summary = { requests: requestCount, concurrency, statuses: Object.fromEntries(statuses), p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: Math.round(durations.at(-1) || 0) };
  console.log(JSON.stringify(summary, null, 2));
  if ((statuses.get(429) || 0) < 1) throw new Error("Rate limit did not return HTTP 429.");
  if ([...statuses].some(([status]) => status >= 500)) throw new Error("Load test observed a server error.");
} finally {
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("admission_windows").delete().eq("subject", connection.id).eq("bucket", "mcp_request");
  await admin.from("mcp_connections").delete().eq("id", connection.id);
}
