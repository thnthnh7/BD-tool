import { createAdminClient } from "@/lib/supabase/admin";
import { oauthError, tokenHash } from "@/features/mcp/server/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const clientId = String(form.get("client_id") || "");
  const token = String(form.get("token") || "");
  if (!clientId || !token) return oauthError("invalid_request", "client_id and token are required.");
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const hash = tokenHash(token);
  await admin.from("mcp_oauth_tokens").update({ revoked_at: now }).eq("client_id", clientId).or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`).is("revoked_at", null);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
