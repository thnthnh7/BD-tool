import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto-utils";
import { getSessionContext } from "@/lib/auth/session";
import { exchangeCrmAuthorizationCode, storeCrmTokens } from "@/features/crm-integrations/server/oauth";

type State = { state: string; provider: string; connectionId: string; workspaceId: string; userId: string; accountLabel: string; createdAt: number };

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  const destination = new URL(`/app/crm-integrations?provider=${provider}`, request.url);
  const finish = (status: string) => { destination.searchParams.set("oauth", status); const response = NextResponse.redirect(destination); response.cookies.delete("leadely_crm_oauth"); return response; };
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get("leadely_crm_oauth")?.value || "";
  if (!code || !state || !cookie) return finish("invalid_callback");
  try {
    const stored = JSON.parse(decryptSecret(cookie)) as State;
    const context = await getSessionContext();
    if (!context || context.kind !== "workspace" || context.memberRole === "member") return finish("forbidden");
    if (stored.state !== state || stored.provider !== provider || stored.workspaceId !== context.workspaceId || stored.userId !== context.userId || Date.now() - stored.createdAt > 600_000) return finish("invalid_state");
    const redirectUri = new URL(`/api/integrations/crm/${provider}/callback`, request.url).toString();
    const token = await exchangeCrmAuthorizationCode({ provider, accountLabel: stored.accountLabel, code, redirectUri, tokenUrlOverride: request.nextUrl.searchParams.get("accounts-server") ? `${request.nextUrl.searchParams.get("accounts-server")}/oauth/v2/token` : undefined });
    await storeCrmTokens({ connectionId: stored.connectionId, userId: context.userId, accessToken: token.accessToken, refreshToken: token.refreshToken, expiresIn: token.expiresIn, scopes: token.scope, metadata: { ...token.metadata, token_url: token.tokenUrl } });
    return finish("connected");
  } catch (error) {
    console.error("CRM OAuth callback failed", error instanceof Error ? error.message : error);
    return finish("connection_failed");
  }
}
