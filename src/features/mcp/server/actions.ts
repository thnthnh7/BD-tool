"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin, requirePlatform } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMcpToken, hashMcpToken, normalizeMcpScopes } from "@/features/mcp/server/service";
import { startMapsScrapeAction } from "@/features/leads/server/scrape-actions";
import type { Json } from "@/lib/database.types";

export async function loadMcpWorkspace() {
  const context = await requireOwnerOrAdmin();
  const admin = createAdminClient();
  await admin.rpc("expire_mcp_action_requests", { p_workspace_id: context.workspaceId });
  const [{ data: connections }, { data: calls }, { data: settings }, { data: actionRequests }] = await Promise.all([
    admin.from("mcp_connections").select("id, name, token_prefix, scopes, status, last_used_at, expires_at, created_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    admin.from("mcp_tool_calls").select("id, tool_name, status, duration_ms, result_count, created_at, connection_id").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }).limit(30),
    admin.from("mcp_settings").select("enabled, read_tools_enabled, write_tools_enabled").eq("id", 1).single(),
    admin.from("mcp_action_requests").select("id, connection_id, action_type, payload, status, error_message, result, created_at, reviewed_at, completed_at, expires_at").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }).limit(30),
  ]);
  return {
    context,
    connections: (connections || []).map((connection) => ({
      ...connection,
      display_status: connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now() ? "expired" : connection.status,
    })),
    calls: calls || [],
    actionRequests: actionRequests || [],
    settings,
  };
}

export async function createMcpConnectionAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const scopes = normalizeMcpScopes(formData.getAll("scopes").map(String));
  const expiry = String(formData.get("expiry") || "90");
  if (!name) return { error: "Enter a connection name." };
  if (!scopes.length) return { error: "Select at least one scope." };
  if (!["30", "90", "365", "never"].includes(expiry)) return { error: "Select a valid expiry period." };
  const token = generateMcpToken();
  const expiresAt = expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
  const { error } = await createAdminClient().from("mcp_connections").insert({
    workspace_id: context.workspaceId,
    created_by: context.userId,
    name,
    token_hash: hashMcpToken(token),
    token_prefix: `${token.slice(0, 13)}…`,
    scopes,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/mcp");
  return { ok: true as const, token };
}

export async function revokeMcpConnectionAction(id: string) {
  const context = await requireOwnerOrAdmin();
  const { error } = await createAdminClient().from("mcp_connections").update({ status: "revoked" }).eq("id", id).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/mcp");
  return { ok: true as const };
}

function payloadObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function reviewMcpActionRequestAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const admin = createAdminClient();
  const { data: request } = await admin.from("mcp_action_requests").select("id, action_type, payload, status, expires_at").eq("id", id).eq("workspace_id", context.workspaceId).maybeSingle();
  if (!request || request.status !== "pending") return;
  const now = new Date().toISOString();
  if (request.expires_at <= now) {
    await admin.from("mcp_action_requests").update({ status: "expired", completed_at: now }).eq("id", id).eq("status", "pending");
    revalidatePath("/app/mcp");
    return;
  }
  if (decision === "reject") {
    await admin.from("mcp_action_requests").update({ status: "rejected", reviewed_by: context.userId, reviewed_at: now, completed_at: now }).eq("id", id).eq("status", "pending");
    revalidatePath("/app/mcp");
    return;
  }
  if (decision !== "approve") return;
  const { data: claimed } = await admin.from("mcp_action_requests").update({ status: "approved", reviewed_by: context.userId, reviewed_at: now }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (!claimed) return;
  const payload = payloadObject(request.payload);
  try {
    let result: Json;
    if (request.action_type === "create_company") {
      const name = String(payload.name || "").trim();
      if (!name) throw new Error("Company name is required.");
      const { data, error } = await admin.from("companies").insert({ workspace_id: context.workspaceId, name, website: String(payload.website || ""), industry: String(payload.industry || ""), email: String(payload.email || ""), phone: String(payload.phone || ""), notes: String(payload.notes || ""), owner_user_id: context.userId }).select("id, name").single();
      if (error) throw error;
      result = data as unknown as Json;
    } else if (request.action_type === "start_maps_scrape") {
      const input = new FormData();
      input.set("query", String(payload.query || "")); input.set("location", String(payload.location || "")); input.set("language", String(payload.language || "en")); input.set("max_results", String(payload.maxResults || 20)); input.set("max_people_per_place", String(payload.maxPeoplePerPlace || 0)); input.set("pdpa_confirmed", "on");
      if (payload.enrichPeople) input.set("enrich_people", "on");
      if (payload.verifyEmails) input.set("verify_emails", "on");
      const scrape = await startMapsScrapeAction(input);
      if (scrape.error) throw new Error(scrape.error);
      result = { jobId: scrape.id };
    } else throw new Error("Unsupported MCP action.");
    await admin.from("mcp_action_requests").update({ status: "completed", result, completed_at: new Date().toISOString() }).eq("id", id);
  } catch (error) {
    await admin.from("mcp_action_requests").update({ status: "failed", error_message: error instanceof Error ? error.message : "Action failed.", completed_at: new Date().toISOString() }).eq("id", id);
  }
  revalidatePath("/app/mcp");
}

export async function rotateMcpConnectionAction(id: string) {
  const context = await requireOwnerOrAdmin();
  const token = generateMcpToken();
  const { data, error } = await createAdminClient().from("mcp_connections").update({
    token_hash: hashMcpToken(token),
    token_prefix: `${token.slice(0, 13)}…`,
    status: "active",
    last_used_at: null,
    expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
  }).eq("id", id).eq("workspace_id", context.workspaceId).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "MCP connection not found." };
  revalidatePath("/app/mcp");
  return { ok: true as const, token };
}

export async function loadPlatformMcp() {
  const context = await requirePlatform();
  const admin = createAdminClient();
  const [{ data: settings }, { data: connections }, { data: calls }, { data: workspaces }, { data: oauthClients }] = await Promise.all([
    admin.from("mcp_settings").select("*").eq("id", 1).single(),
    admin.from("mcp_connections").select("id, workspace_id, name, token_prefix, scopes, status, last_used_at, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("mcp_tool_calls").select("id, workspace_id, tool_name, status, duration_ms, result_count, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("workspaces").select("id, name"),
    admin.from("mcp_oauth_clients").select("client_id, client_name, redirect_uris, status, created_at, last_used_at").order("created_at", { ascending: false }).limit(100),
  ]);
  return { canMutate: context.platformRole === "super_admin", settings, connections: connections || [], calls: calls || [], oauthClients: oauthClients || [], workspaceNames: Object.fromEntries((workspaces || []).map((workspace) => [workspace.id, workspace.name])) };
}

export async function updateMcpSettingsAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const { error } = await createAdminClient().from("mcp_settings").update({
    enabled: formData.get("enabled") === "on",
    read_tools_enabled: formData.get("read_tools_enabled") === "on",
    write_tools_enabled: formData.get("write_tools_enabled") === "on",
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/app/platform/mcp");
  revalidatePath("/app/mcp");
  return { ok: true as const };
}

export async function setMcpOAuthClientStatusAction(formData: FormData) {
  await requirePlatform("super_admin");
  const clientId = String(formData.get("client_id") || "");
  const status = String(formData.get("status") || "") === "active" ? "active" : "revoked";
  const admin = createAdminClient();
  const { error } = await admin.from("mcp_oauth_clients").update({ status }).eq("client_id", clientId);
  if (error) throw new Error(error.message);
  if (status === "revoked") await admin.from("mcp_oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("client_id", clientId).is("revoked_at", null);
  revalidatePath("/app/platform/mcp");
}
