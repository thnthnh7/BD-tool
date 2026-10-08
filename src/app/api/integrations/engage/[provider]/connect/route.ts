import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto-utils";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { engagementAuthorizationUrl, engagementProviderReady, isEngagementProvider } from "@/features/comms/server/providers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const context = await requireOwnerOrAdmin();
  const { provider: rawProvider } = await params;
  if (!isEngagementProvider(rawProvider)) return NextResponse.redirect(new URL("/app/inbox?oauth=unsupported", request.url));
  if (!context.plan.features.inbox && !context.plan.features.calendar && !context.plan.features.sequences) {
    return NextResponse.redirect(new URL("/app/billing?required=inbox", request.url));
  }
  if (!engagementProviderReady(rawProvider)) return NextResponse.redirect(new URL(`/app/inbox?oauth=${rawProvider}_not_configured`, request.url));
  const state = randomUUID();
  const redirectUri = new URL(`/api/integrations/engage/${rawProvider}/callback`, request.url).toString();
  const cookie = encryptSecret(JSON.stringify({ state, provider: rawProvider, workspaceId: context.workspaceId, userId: context.userId, createdAt: Date.now() }));
  const response = NextResponse.redirect(engagementAuthorizationUrl(rawProvider, redirectUri, state));
  response.cookies.set("bizcraw_engagement_oauth", cookie, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/engage", maxAge: 600 });
  return response;
}
