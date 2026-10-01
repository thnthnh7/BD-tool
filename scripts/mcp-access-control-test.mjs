import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createMcpTestWorkspace } from "./mcp-test-fixture.mjs";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.MCP_TEST_BASE_URL || "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixture = await createMcpTestWorkspace(admin);
const foreignFixture = await createMcpTestWorkspace(admin);
const tokens = [];
const { data: settings, error: settingsError } = await admin.from("mcp_settings").select("enabled, read_tools_enabled, write_tools_enabled").eq("id", 1).single();
if (settingsError) throw settingsError;

async function connection(scopes, attributes = {}) {
  const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
  const { data, error } = await admin.from("mcp_connections").insert({ workspace_id: fixture.workspace.id, name: "MCP access-control test", token_hash: createHash("sha256").update(token).digest("hex"), token_prefix: `${token.slice(0, 13)}…`, scopes, expires_at: new Date(Date.now() + 300_000).toISOString(), ...attributes }).select("id").single();
  if (error) throw error;
  tokens.push({ token, id: data.id });
  return { token, id: data.id };
}

async function request(token, method = "tools/list") {
  return fetch(`${base}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} }) });
}

async function callTool(token, name, args) {
  return fetch(`${base}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) });
}

try {
  await admin.from("mcp_settings").update({ enabled: true, read_tools_enabled: true, write_tools_enabled: false }).eq("id", 1);
  const limited = await connection(["workspace:read"]);
  const limitedResponse = await request(limited.token);
  assert.equal(limitedResponse.status, 200);
  const limitedBody = await limitedResponse.json();
  const limitedTools = limitedBody.result.tools.map((tool) => tool.name);
  assert.ok(limitedTools.includes("get_workspace"));
  assert.ok(!limitedTools.includes("search_companies"));
  const crmReader = await connection(["workspace:read", "crm:read"]);
  const { data: foreignCompany, error: foreignCompanyError } = await admin.from("companies").insert({ workspace_id: foreignFixture.workspace.id, name: "Foreign MCP security fixture" }).select("id").single();
  if (foreignCompanyError) throw foreignCompanyError;
  const foreignCompanyBody = await (await callTool(crmReader.token, "get_company", { companyId: foreignCompany.id })).json();
  assert.equal(JSON.parse(foreignCompanyBody.result.content[0].text), null);

  const writeScoped = await connection(["workspace:read", "crm:write"]);
  const writeDisabledBody = await (await request(writeScoped.token)).json();
  assert.ok(!writeDisabledBody.result.tools.some((tool) => tool.name === "create_company"));

  const expired = await connection(["workspace:read"], { expires_at: new Date(Date.now() - 1_000).toISOString() });
  assert.equal((await request(expired.token)).status, 401);
  const revoked = await connection(["workspace:read"], { status: "revoked" });
  assert.equal((await request(revoked.token)).status, 401);

  await admin.from("workspaces").update({ locked: true }).eq("id", fixture.workspace.id);
  assert.equal((await request(limited.token)).status, 403);
  await admin.from("workspaces").update({ locked: false, archived_at: new Date().toISOString() }).eq("id", fixture.workspace.id);
  assert.equal((await request(limited.token)).status, 403);
  await admin.from("workspaces").update({ archived_at: null }).eq("id", fixture.workspace.id);
  await admin.from("workspaces").update({ locked: false, plan_status: "expired" }).eq("id", fixture.workspace.id);
  assert.equal((await request(limited.token)).status, 403);
  await admin.from("workspaces").update({ plan_status: "trialing" }).eq("id", fixture.workspace.id);
  await admin.from("workspace_overrides").update({ features: { mcp_access: false } }).eq("workspace_id", fixture.workspace.id);
  assert.equal((await request(limited.token)).status, 403);
  await admin.from("workspace_overrides").update({ features: { mcp_access: true } }).eq("workspace_id", fixture.workspace.id);

  await admin.from("mcp_settings").update({ read_tools_enabled: false }).eq("id", 1);
  assert.equal((await request(limited.token)).status, 503);

  console.log(JSON.stringify({ scopeIsolation: true, crossWorkspaceRecordIsolation: true, writeRollout: true, expiredToken: true, revokedToken: true, lockedWorkspace: true, archivedWorkspace: true, inactivePlan: true, entitlementRemoval: true, readRollout: true }, null, 2));
} finally {
  await admin.from("mcp_settings").update(settings).eq("id", 1);
  await admin.from("mcp_tool_calls").delete().in("connection_id", tokens.map((item) => item.id));
  await foreignFixture.cleanup();
  await fixture.cleanup();
}
