import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createMcpTestWorkspace } from "./mcp-test-fixture.mjs";

nextEnv.loadEnvConfig(process.cwd());
const base = (process.env.MCP_SECURITY_BASE_URL || "https://bizcraw.com").replace(/\/$/, "");
if (!base.startsWith("https://")) throw new Error("Production security checks require an HTTPS target.");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixture = await createMcpTestWorkspace(admin);
const foreignFixture = await createMcpTestWorkspace(admin);
const connectionIds = [];

async function createConnection(scopes, attributes = {}) {
  const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
  const { data, error } = await admin.from("mcp_connections").insert({
    workspace_id: fixture.workspace.id,
    name: "Production security assessment",
    token_hash: createHash("sha256").update(token).digest("hex"),
    token_prefix: `${token.slice(0, 13)}…`,
    scopes,
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    ...attributes,
  }).select("id").single();
  if (error) throw error;
  connectionIds.push(data.id);
  return token;
}

function rpcBody(method, params = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
}

async function mcp(token, method, params = {}) {
  return fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: rpcBody(method, params),
  });
}

try {
  const metadataResponse = await fetch(`${base}/.well-known/oauth-protected-resource/api/mcp`);
  assert.equal(metadataResponse.status, 200);
  const metadata = await metadataResponse.json();
  assert.equal(metadata.resource, `${base}/api/mcp`);
  assert.equal(metadata.resource_name, "Bizcraw MCP");
  assert.ok(metadata.scopes_supported.includes("offline_access"));

  const anonymous = await fetch(`${base}/api/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: rpcBody("initialize") });
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("www-authenticate") || "", /oauth-protected-resource\/api\/mcp/);
  assert.match(anonymous.headers.get("cache-control") || "", /no-store/);
  assert.equal(anonymous.headers.get("access-control-allow-origin"), null);

  const randomToken = await mcp(`ldmcp_${randomBytes(32).toString("base64url")}`, "tools/list");
  assert.equal(randomToken.status, 401);

  const invalidRegistration = await fetch(`${base}/api/mcp/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Invalid security probe", redirect_uris: ["javascript:alert(1)"], token_endpoint_auth_method: "none" }),
  });
  assert.equal(invalidRegistration.status, 400);

  const workspaceOnly = await createConnection(["workspace:read"]);
  const toolsResponse = await mcp(workspaceOnly, "tools/list");
  assert.equal(toolsResponse.status, 200);
  const toolsBody = await toolsResponse.json();
  assert.ok(toolsBody.result.tools.some((tool) => tool.name === "get_workspace"));
  assert.ok(!toolsBody.result.tools.some((tool) => tool.name === "search_companies"));

  const crmReader = await createConnection(["workspace:read", "crm:read"]);
  const { data: foreignCompany, error: foreignCompanyError } = await admin.from("companies").insert({ workspace_id: foreignFixture.workspace.id, name: "Foreign production security fixture" }).select("id").single();
  if (foreignCompanyError) throw foreignCompanyError;
  const crossWorkspaceResponse = await mcp(crmReader, "tools/call", { name: "get_company", arguments: { companyId: foreignCompany.id } });
  assert.equal(crossWorkspaceResponse.status, 200);
  const crossWorkspaceBody = await crossWorkspaceResponse.json();
  assert.equal(JSON.parse(crossWorkspaceBody.result.content[0].text), null);

  const oversizedResponse = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${workspaceOnly}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: rpcBody("tools/call", { name: "get_workspace", arguments: { padding: "x".repeat(300 * 1024) } }),
  });
  assert.ok([400, 413].includes(oversizedResponse.status), `Expected oversized request rejection, received ${oversizedResponse.status}`);

  const expired = await createConnection(["workspace:read"], { expires_at: new Date(Date.now() - 1_000).toISOString() });
  assert.equal((await mcp(expired, "tools/list")).status, 401);
  const revoked = await createConnection(["workspace:read"], { status: "revoked" });
  assert.equal((await mcp(revoked, "tools/list")).status, 401);

  console.log(JSON.stringify({
    target: base,
    oauthMetadataBound: true,
    anonymousRejected: true,
    randomTokenRejected: true,
    unsafeRedirectRejected: true,
    scopeIsolation: true,
    crossWorkspaceIsolation: true,
    oversizedBodyRejected: true,
    expiredTokenRejected: true,
    revokedTokenRejected: true,
  }, null, 2));
} finally {
  if (connectionIds.length) {
    await admin.from("mcp_tool_calls").delete().in("connection_id", connectionIds);
    await admin.from("mcp_connections").delete().in("id", connectionIds);
  }
  await foreignFixture.cleanup();
  await fixture.cleanup();
}
