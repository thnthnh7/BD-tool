import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://*.stripe.com https://*.paypal.com https://*.sepay.vn",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://eewoirdimfpfborwdbzx.supabase.co https://images.apifyusercontent.com https://*.stripe.com https://*.paypalobjects.com",
    "font-src 'self' data:",
    "connect-src 'self' https://eewoirdimfpfborwdbzx.supabase.co wss://eewoirdimfpfborwdbzx.supabase.co https://*.stripe.com https://*.paypal.com",
    "upgrade-insecure-requests",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const { supabase, response } = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isAuthed = Boolean(data?.claims);

  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/forgot");
  const isApp = path.startsWith("/app") || path.startsWith("/onboarding");

  if (!isAuthed && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  if (isAuthed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login", "/signup", "/forgot"],
};
