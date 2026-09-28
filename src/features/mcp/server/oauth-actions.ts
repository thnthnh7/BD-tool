"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/auth/session";
import { mcpResource, normalizeOAuthScopes, oauthCodeTtlSeconds, opaqueToken, tokenHash, validPkceChallenge } from "@/features/mcp/server/oauth";

export async function approveMcpOAuthAction(formData: FormData) {
  const context = await requireWorkspace();
  if (!context.plan.features.mcp_access || context.locked || ["expired", "canceled"].includes(context.planStatus)) redirect("/app/billing");
  const clientId = String(formData.get("client_id") || "");
  const redirectUri = String(formData.get("redirect_uri") || "");
  const state = String(formData.get("state") || "");
  const challenge = String(formData.get("code_challenge") || "");
  const resource = String(formData.get("resource") || "");
  const scopes = normalizeOAuthScopes(String(formData.get("scope") || ""));
  const expectedResource = mcpResource();
  const admin = createAdminClient();
  const { data: client } = await admin.from("mcp_oauth_clients").select("client_id, client_name, redirect_uris, status").eq("client_id", clientId).maybeSingle();
  if (!client || client.status !== "active" || !client.redirect_uris.includes(redirectUri) || !validPkceChallenge(challenge) || resource !== expectedResource) redirect("/app/mcp?oauth=invalid_request");

  const linkageToken = opaqueToken("ldmcp_link_");
  const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({
    workspace_id: context.workspaceId,
    created_by: context.userId,
    name: `OAuth · ${client.client_name}`.slice(0, 80),
    token_hash: tokenHash(linkageToken),
    token_prefix: "OAuth",
    scopes,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).select("id").single();
  if (connectionError || !connection) redirect("/app/mcp?oauth=server_error");

  const code = opaqueToken("ldcode_");
  const { error } = await admin.from("mcp_oauth_codes").insert({
    code_hash: tokenHash(code), client_id: clientId, connection_id: connection.id, workspace_id: context.workspaceId, user_id: context.userId,
    redirect_uri: redirectUri, scopes, code_challenge: challenge, resource,
    expires_at: new Date(Date.now() + oauthCodeTtlSeconds * 1000).toISOString(),
  });
  if (error) { await admin.from("mcp_connections").delete().eq("id", connection.id); redirect("/app/mcp?oauth=server_error"); }
  const destination = new URL(redirectUri);
  destination.searchParams.set("code", code);
  if (state) destination.searchParams.set("state", state);
  redirect(destination.toString());
}

export async function denyMcpOAuthAction(formData: FormData) {
  const redirectUri = String(formData.get("redirect_uri") || "");
  const clientId = String(formData.get("client_id") || "");
  const state = String(formData.get("state") || "");
  const { data: client } = await createAdminClient().from("mcp_oauth_clients").select("redirect_uris, status").eq("client_id", clientId).maybeSingle();
  if (!client || client.status !== "active" || !client.redirect_uris.includes(redirectUri)) redirect("/app/mcp");
  const destination = new URL(redirectUri);
  destination.searchParams.set("error", "access_denied");
  if (state) destination.searchParams.set("state", state);
  redirect(destination.toString());
}
