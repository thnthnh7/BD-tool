import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { supabase, response } = await updateSession(request);
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isAuthed = Boolean(data?.claims);

  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/forgot");
  const isApp = path.startsWith("/app") || path.startsWith("/onboarding");

  if (!isAuthed && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
