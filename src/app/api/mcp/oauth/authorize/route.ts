import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mcpResource, normalizeOAuthScopes, oauthError, validPkceChallenge } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const input = new URL(request.url);
  const clientId = input.searchParams.get("client_id") || "";
  const redirectUri = input.searchParams.get("redirect_uri") || "";
  const challenge = input.searchParams.get("code_challenge") || "";
  const resource = input.searchParams.get("resource") || mcpResource(request);
  if (input.searchParams.get("response_type") !== "code") return oauthError("unsupported_response_type", "Only response_type=code is supported.");
  if (input.searchParams.get("code_challenge_method") !== "S256" || !validPkceChallenge(challenge)) return oauthError("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  if (resource !== mcpResource(request)) return oauthError("invalid_target", "The requested resource does not match this MCP server.");
  const { data: client } = await createAdminClient().from("mcp_oauth_clients").select("client_id, redirect_uris, status").eq("client_id", clientId).maybeSingle();
  if (!client || client.status !== "active" || !client.redirect_uris.includes(redirectUri)) return oauthError("invalid_request", "Unknown client or unregistered redirect_uri.");
  const target = new URL("/app/mcp/authorize", input.origin);
  for (const key of ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "resource"] as const) {
    const value = input.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set("scope", normalizeOAuthScopes(input.searchParams.get("scope")).join(" "));
  const loginAwareTarget = new URL(target);
  const login = new URL("/login", input.origin);
  login.searchParams.set("next", `${loginAwareTarget.pathname}${loginAwareTarget.search}`);
  const { data: { user } } = await (await createClient()).auth.getUser();
  return NextResponse.redirect(user ? target : login);
}
