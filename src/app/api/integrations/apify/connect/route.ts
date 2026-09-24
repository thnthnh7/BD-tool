import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto-utils";
import { getSessionContext } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const context = await getSessionContext();
  if (!context || context.kind !== "workspace") return NextResponse.redirect(new URL("/login", request.url));
  if (context.memberRole === "member") return NextResponse.redirect(new URL("/app/settings?apify=forbidden", request.url));
  const clientId = process.env.APIFY_OAUTH_CLIENT_ID || "";
  const authorizationUrl = process.env.APIFY_OAUTH_AUTHORIZATION_URL || "";
  if (!clientId || !authorizationUrl) return NextResponse.redirect(new URL("/app/settings?apify=not_configured", request.url));

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/integrations/apify/callback", request.url).toString();
  const payload = encryptSecret(JSON.stringify({ state, workspaceId: context.workspaceId, userId: context.userId, createdAt: Date.now() }));
  const target = new URL(authorizationUrl);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", clientId);
  target.searchParams.set("redirect_uri", redirectUri);
  target.searchParams.set("scope", process.env.APIFY_OAUTH_SCOPES || "profile full_api_access");
  target.searchParams.set("state", state);

  const response = NextResponse.redirect(target);
  response.cookies.set("leadely_apify_oauth", payload, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/apify", maxAge: 600 });
  return response;
}
