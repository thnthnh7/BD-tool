import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto-utils";
import { getSessionContext } from "@/lib/auth/session";
import { exchangeApifyCode, saveApifyOauthConnection } from "@/features/leads/server/apify-connection";

export async function GET(request: NextRequest) {
  const destination = new URL("/app/settings", request.url);
  const fail = (reason: string) => {
    destination.searchParams.set("apify", reason);
    const response = NextResponse.redirect(destination);
    response.cookies.delete("leadely_apify_oauth");
    return response;
  };
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get("leadely_apify_oauth")?.value || "";
  if (!code || !state || !cookie) return fail("invalid_callback");
  try {
    const stored = JSON.parse(decryptSecret(cookie)) as { state: string; workspaceId: string; userId: string; createdAt: number };
    const context = await getSessionContext();
    if (!context || context.kind !== "workspace" || context.memberRole === "member") return fail("forbidden");
    if (stored.state !== state || stored.workspaceId !== context.workspaceId || stored.userId !== context.userId || Date.now() - stored.createdAt > 600_000) return fail("invalid_state");
    const redirectUri = new URL("/api/integrations/apify/callback", request.url).toString();
    const token = await exchangeApifyCode(code, redirectUri);
    await saveApifyOauthConnection({ workspaceId: context.workspaceId, userId: context.userId, accessToken: token.access_token!, refreshToken: token.refresh_token, expiresIn: token.expires_in });
    destination.searchParams.set("apify", "connected");
    const response = NextResponse.redirect(destination);
    response.cookies.delete("leadely_apify_oauth");
    return response;
  } catch (error) {
    console.error("Apify OAuth callback failed", error instanceof Error ? error.message : error);
    return fail("connection_failed");
  }
}
