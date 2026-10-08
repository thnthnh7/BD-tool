import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto-utils";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { exchangeEngagementCode, getEngagementProfile, isEngagementProvider } from "@/features/comms/server/providers";
import { saveEngagementAccount } from "@/features/comms/server/accounts";

type State = { state: string; provider: string; workspaceId: string; userId: string; createdAt: number };

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const destination = new URL("/app/inbox", request.url);
  const finish = (status: string) => {
    destination.searchParams.set("oauth", status);
    const response = NextResponse.redirect(destination);
    response.cookies.delete("bizcraw_engagement_oauth");
    return response;
  };
  if (!isEngagementProvider(rawProvider)) return finish("unsupported");
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookie = request.cookies.get("bizcraw_engagement_oauth")?.value || "";
  if (!code || !state || !cookie) return finish("invalid_state");
  try {
    const stored = JSON.parse(decryptSecret(cookie)) as State;
    const context = await requireOwnerOrAdmin();
    if (stored.state !== state || stored.provider !== rawProvider || stored.workspaceId !== context.workspaceId || stored.userId !== context.userId || Date.now() - stored.createdAt > 10 * 60_000) {
      return finish("invalid_state");
    }
    const redirectUri = new URL(`/api/integrations/engage/${rawProvider}/callback`, request.url).toString();
    const token = await exchangeEngagementCode(rawProvider, code, redirectUri);
    const profile = await getEngagementProfile(rawProvider, token.accessToken);
    if (!profile.id || !profile.email) return finish("missing_profile");
    await saveEngagementAccount({
      workspaceId: context.workspaceId,
      userId: context.userId,
      provider: rawProvider,
      providerAccountId: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresIn: token.expiresIn,
      scopes: token.scopes,
    });
    return finish("connected");
  } catch {
    return finish("failed");
  }
}
