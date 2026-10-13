import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMailToken } from "@/lib/mail-marketing/tokens";

async function unsubscribe(token: string) {
  const payload = verifyMailToken(token, "unsubscribe");
  if (!payload) return false;
  const admin = createAdminClient();
  await Promise.all([
    admin.from("email_preferences").upsert({ user_id: payload.userId, product_tips: false, beta_updates: false, announcements: false, unsubscribed_all: true, consent_source: "unsubscribe", unsubscribed_at: new Date().toISOString() }),
    admin.from("mail_marketing_suppressions").upsert({ email: payload.email.toLowerCase(), user_id: payload.userId, reason: "unsubscribe", source: "email_link" }),
    admin.from("mail_marketing_deliveries").update({ status: "canceled", last_error: "unsubscribed" }).eq("user_id", payload.userId).in("status", ["queued", "failed"]),
  ]);
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribe(url.searchParams.get("token") || "");
  return NextResponse.redirect(new URL(ok ? "/email-preferences?unsubscribed=1" : "/email-preferences?invalid=1", url));
}
export async function POST(request: Request) {
  const form = await request.formData();
  const queryToken = new URL(request.url).searchParams.get("token");
  return new NextResponse((await unsubscribe(String(form.get("token") || queryToken || ""))) ? "Unsubscribed" : "Invalid token", { status: 200 });
}
