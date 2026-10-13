import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMailToken } from "@/lib/mail-marketing/tokens";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const payload = verifyMailToken(token, "preferences");
  if (!payload) return NextResponse.redirect(new URL("/email-preferences?invalid=1", request.url));
  const productTips = form.get("product_tips") === "on", betaUpdates = form.get("beta_updates") === "on", announcements = form.get("announcements") === "on";
  const unsubscribed = !(productTips || betaUpdates || announcements);
  const admin = createAdminClient();
  await admin.from("email_preferences").upsert({ user_id: payload.userId, product_tips: productTips, beta_updates: betaUpdates, announcements, unsubscribed_all: unsubscribed, consent_source: "preferences", consent_at: unsubscribed ? null : new Date().toISOString(), unsubscribed_at: unsubscribed ? new Date().toISOString() : null });
  if (unsubscribed) await admin.from("mail_marketing_suppressions").upsert({ email: payload.email.toLowerCase(), user_id: payload.userId, reason: "unsubscribe", source: "preferences" });
  else await admin.from("mail_marketing_suppressions").delete().eq("email", payload.email.toLowerCase()).eq("reason", "unsubscribe");
  return NextResponse.redirect(new URL(`/email-preferences?token=${encodeURIComponent(token)}&saved=1`, request.url), 303);
}
