import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOAuthScopes, oauthAccessTtlSeconds, oauthError, oauthRefreshTtlSeconds, opaqueToken, tokenHash, verifyPkce } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

function tokenResponse(accessToken: string, refreshToken: string, scopes: string[]) {
  return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: oauthAccessTtlSeconds, refresh_token: refreshToken, scope: [...scopes, "offline_access"].join(" ") }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded")) return oauthError("invalid_request", "Use application/x-www-form-urlencoded.");
  const form = await request.formData();
  const grantType = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  const admin = createAdminClient();
  const { data: client } = await admin.from("mcp_oauth_clients").select("client_id, status").eq("client_id", clientId).maybeSingle();
  if (!client || client.status !== "active") return oauthError("invalid_client", "Unknown or revoked client.", 401);

  if (grantType === "authorization_code") {
    const code = String(form.get("code") || "");
    const verifier = String(form.get("code_verifier") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const resource = String(form.get("resource") || "");
    const now = new Date().toISOString();
    const codeHash = tokenHash(code);
    const { data: authorization } = await admin.from("mcp_oauth_codes").select("connection_id, workspace_id, user_id, scopes, code_challenge, resource").eq("code_hash", codeHash).eq("client_id", clientId).eq("redirect_uri", redirectUri).eq("resource", resource).is("used_at", null).gt("expires_at", now).maybeSingle();
    if (!authorization || !verifyPkce(verifier, authorization.code_challenge)) return oauthError("invalid_grant", "Authorization code is invalid, expired, already used, or PKCE verification failed.");
    const { data: consumed } = await admin.from("mcp_oauth_codes").update({ used_at: now }).eq("code_hash", codeHash).is("used_at", null).select("code_hash").maybeSingle();
    if (!consumed) return oauthError("invalid_grant", "Authorization code was already used.");
    const accessToken = opaqueToken("ldaccess_");
    const refreshToken = opaqueToken("ldrefresh_");
    const { error } = await admin.from("mcp_oauth_tokens").insert({
      access_token_hash: tokenHash(accessToken), refresh_token_hash: tokenHash(refreshToken), client_id: clientId,
      connection_id: authorization.connection_id, workspace_id: authorization.workspace_id, user_id: authorization.user_id,
      scopes: authorization.scopes, resource: authorization.resource,
      access_expires_at: new Date(Date.now() + oauthAccessTtlSeconds * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + oauthRefreshTtlSeconds * 1000).toISOString(),
    });
    if (error) return oauthError("server_error", "Could not issue tokens.", 500);
    await admin.from("mcp_oauth_clients").update({ last_used_at: now }).eq("client_id", clientId);
    return tokenResponse(accessToken, refreshToken, authorization.scopes);
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") || "");
    const now = new Date().toISOString();
    const { data: current } = await admin.from("mcp_oauth_tokens").update({ revoked_at: now }).eq("refresh_token_hash", tokenHash(refreshToken)).eq("client_id", clientId).is("revoked_at", null).gt("refresh_expires_at", now).select("connection_id, workspace_id, user_id, scopes, resource").maybeSingle();
    if (!current) return oauthError("invalid_grant", "Refresh token is invalid, expired, or already used.");
    const requested = normalizeOAuthScopes(String(form.get("scope") || current.scopes.join(" "))).filter((scope) => current.scopes.includes(scope));
    const accessToken = opaqueToken("ldaccess_");
    const nextRefreshToken = opaqueToken("ldrefresh_");
    const { error } = await admin.from("mcp_oauth_tokens").insert({
      access_token_hash: tokenHash(accessToken), refresh_token_hash: tokenHash(nextRefreshToken), client_id: clientId,
      connection_id: current.connection_id, workspace_id: current.workspace_id, user_id: current.user_id,
      scopes: requested, resource: current.resource,
      access_expires_at: new Date(Date.now() + oauthAccessTtlSeconds * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + oauthRefreshTtlSeconds * 1000).toISOString(),
    });
    if (error) return oauthError("server_error", "Could not rotate tokens.", 500);
    return tokenResponse(accessToken, nextRefreshToken, requested);
  }
  return oauthError("unsupported_grant_type", "Supported grants are authorization_code and refresh_token.");
}
