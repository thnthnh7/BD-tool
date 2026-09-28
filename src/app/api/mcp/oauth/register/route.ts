import { createAdminClient } from "@/lib/supabase/admin";
import { admit } from "@/lib/admission";
import { oauthError, opaqueToken, validateRedirectUri } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const admin = createAdminClient();
  const gate = await admit(admin, ip, "mcp_oauth_register", 20, 60);
  if (!("ok" in gate)) return oauthError("temporarily_unavailable", gate.error, gate.status);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return oauthError("invalid_client_metadata", "A valid JSON body is required."); }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((item): item is string => typeof item === "string") : [];
  if (!redirectUris.length || redirectUris.length > 10 || redirectUris.some((uri) => uri.length > 2048 || !validateRedirectUri(uri))) return oauthError("invalid_redirect_uri", "Use 1-10 HTTPS redirect URIs; localhost HTTP is allowed for local clients.");
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") return oauthError("invalid_client_metadata", "Only public clients with token_endpoint_auth_method=none are supported.");
  const clientId = opaqueToken("ldclient_");
  const clientName = String(body.client_name || "MCP client").trim().slice(0, 120) || "MCP client";
  const { error } = await admin.from("mcp_oauth_clients").insert({ client_id: clientId, client_name: clientName, redirect_uris: [...new Set(redirectUris)] });
  if (error) return oauthError("server_error", "Could not register the client.", 500);
  return Response.json({ client_id: clientId, client_name: clientName, redirect_uris: [...new Set(redirectUris)], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
