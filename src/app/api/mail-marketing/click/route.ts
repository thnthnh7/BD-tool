import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMailToken } from "@/lib/mail-marketing/tokens";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = verifyMailToken(url.searchParams.get("token") || "", "click");
  if (!payload || !payload.path?.startsWith("/") || payload.path.startsWith("//")) return NextResponse.redirect(new URL("/", url));
  if (payload.deliveryId) await createAdminClient().from("mail_marketing_deliveries").update({ clicked_at: new Date().toISOString() }).eq("id", payload.deliveryId).is("clicked_at", null);
  return NextResponse.redirect(new URL(payload.path, process.env.NEXT_PUBLIC_SITE_URL || url.origin));
}
