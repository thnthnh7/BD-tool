import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { crmOAuthDefinition } from "@/features/crm-integrations/server/oauth";
import { getCrmProviderCredentials } from "@/features/crm-integrations/server/credentials";
import { encryptSecret } from "@/lib/crypto-utils";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const context = await getSessionContext();
  const provider = (await params).provider;
  if (!context || context.kind !== "workspace") return NextResponse.redirect(new URL("/login", request.url));
  if (context.memberRole === "member") return NextResponse.redirect(new URL(`/app/crm-integrations?provider=${provider}&oauth=forbidden`, request.url));
  const supabase = await createClient();
  const [{ data: connection }, { data: availability }] = await Promise.all([
    supabase.from("crm_connections").select("id, account_label").eq("workspace_id", context.workspaceId).eq("provider", provider).maybeSingle(),
    supabase.rpc("crm_provider_availability"),
  ]);
  const enabled = availability?.find((item) => item.provider === provider)?.enabled;
  const definition = crmOAuthDefinition(provider, connection?.account_label || "");
  const credentials = await getCrmProviderCredentials(provider);
  if (!connection || !enabled || !definition || !credentials) return NextResponse.redirect(new URL(`/app/crm-integrations?provider=${provider}&oauth=not_ready`, request.url));
  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL(`/api/integrations/crm/${provider}/callback`, request.url).toString();
  const cookie = encryptSecret(JSON.stringify({ state, provider, connectionId: connection.id, workspaceId: context.workspaceId, userId: context.userId, accountLabel: connection.account_label, createdAt: Date.now() }));
  const target = new URL(definition.authorizationUrl);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", credentials.clientId);
  target.searchParams.set("redirect_uri", redirectUri);
  if (definition.scopes.length) target.searchParams.set("scope", definition.scopes.join(provider === "zoho" ? "," : " "));
  target.searchParams.set("state", state);
  for (const [key, value] of Object.entries(definition.extraAuthorize || {})) target.searchParams.set(key, value);
  const response = NextResponse.redirect(target);
  response.cookies.set("leadely_crm_oauth", cookie, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/crm", maxAge: 600 });
  return response;
}
