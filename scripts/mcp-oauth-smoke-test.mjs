import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createMcpTestWorkspace } from "./mcp-test-fixture.mjs";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.MCP_TEST_BASE_URL || "http://localhost:3000";
const resource = `${(process.env.MCP_TEST_RESOURCE_URL || process.env.NEXT_PUBLIC_SITE_URL || base).replace(/\/$/, "")}/api/mcp`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const digest = (value) => createHash("sha256").update(value).digest("hex");
const redirectUri = "http://127.0.0.1:9876/callback";

const registrationResponse = await fetch(`${base}/api/mcp/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "OAuth smoke test", redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }) });
const registration = await registrationResponse.json();
if (!registrationResponse.ok) throw new Error(JSON.stringify(registration));
const fixture = await createMcpTestWorkspace(admin);
const workspace = fixture.workspace;
const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const linkage = `ldmcp_link_${randomBytes(32).toString("base64url")}`;
const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspace.id, name: "OAuth smoke test", token_hash: digest(linkage), token_prefix: "OAuth", scopes: ["workspace:read"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
if (connectionError) throw connectionError;
const code = `ldcode_${randomBytes(32).toString("base64url")}`;
const { error: codeError } = await admin.from("mcp_oauth_codes").insert({ code_hash: digest(code), client_id: registration.client_id, connection_id: connection.id, workspace_id: workspace.id, redirect_uri: redirectUri, scopes: ["workspace:read"], code_challenge: challenge, resource, expires_at: new Date(Date.now() + 300_000).toISOString() });
if (codeError) throw codeError;

try {
  const invalidRedirectResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: registration.client_id, code, code_verifier: verifier, redirect_uri: "http://127.0.0.1:9876/wrong", resource }) });
  const invalidPkceResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: registration.client_id, code, code_verifier: `${verifier}-wrong`, redirect_uri: redirectUri, resource }) });
  assert.equal(invalidRedirectResponse.status, 400);
  assert.equal(invalidPkceResponse.status, 400);
  const tokenResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: registration.client_id, code, code_verifier: verifier, redirect_uri: redirectUri, resource }) });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(JSON.stringify(tokens));
  assert.ok(tokens.scope.split(" ").includes("offline_access"));
  const replayResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: registration.client_id, code, code_verifier: verifier, redirect_uri: redirectUri, resource }) });
  assert.equal(replayResponse.status, 400);
  const mcpResponse = await fetch(`${base}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${tokens.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "oauth-smoke", version: "1" } } }) });
  const initialized = await mcpResponse.json();
  if (!mcpResponse.ok) throw new Error(JSON.stringify(initialized));
  const refreshResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: registration.client_id, refresh_token: tokens.refresh_token }) });
  const refreshed = await refreshResponse.json();
  if (!refreshResponse.ok) throw new Error(JSON.stringify(refreshed));
  const reusedRefreshResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: registration.client_id, refresh_token: tokens.refresh_token }) });
  assert.equal(reusedRefreshResponse.status, 400);
  await admin.from("mcp_oauth_clients").update({ status: "revoked" }).eq("client_id", registration.client_id);
  const revokedClientResponse = await fetch(`${base}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: registration.client_id, refresh_token: refreshed.refresh_token }) });
  assert.equal(revokedClientResponse.status, 401);
  await admin.from("mcp_oauth_clients").update({ status: "active" }).eq("client_id", registration.client_id);
  await fetch(`${base}/api/mcp/oauth/revoke`, { method: "POST", body: new URLSearchParams({ client_id: registration.client_id, token: refreshed.access_token }) });
  const revokedTokenResponse = await fetch(`${base}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${refreshed.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "oauth-smoke", version: "1" } } }) });
  assert.equal(revokedTokenResponse.status, 401);
  console.log(JSON.stringify({ registered: registration.client_id.startsWith("ldclient_"), tokenIssued: tokens.access_token.startsWith("ldaccess_"), offlineAccessAdvertised: tokens.scope.split(" ").includes("offline_access"), mcp: initialized.result?.serverInfo?.name, refreshRotated: refreshed.refresh_token !== tokens.refresh_token, invalidRedirectRejected: true, invalidPkceRejected: true, codeReplayRejected: true, refreshReplayRejected: true, revokedClientRejected: true, revokedTokenRejected: true }, null, 2));
} finally {
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
  await admin.from("mcp_oauth_clients").delete().eq("client_id", registration.client_id);
  await fixture.cleanup();
}
