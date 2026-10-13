import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

function validSignature(raw: string, request: Request) {
  const configured = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get("svix-id"), timestamp = request.headers.get("svix-timestamp"), signatures = request.headers.get("svix-signature");
  if (!configured || !id || !timestamp || !signatures || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = Buffer.from(configured.replace(/^whsec_/, ""), "base64");
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
    return signatures.split(" ").some((entry) => {
      const received = entry.split(",")[1] || "";
      const a = Buffer.from(received), b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
  } catch { return false; }
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const event = JSON.parse(raw) as { type: string; data?: { email_id?: string; to?: string[] } };
  const eventId = request.headers.get("svix-id")!;
  const providerId = event.data?.email_id || null;
  const admin = createAdminClient();
  const { error } = await admin.from("mail_marketing_provider_events").insert({ provider_event_id: eventId, event_type: event.type, provider_message_id: providerId, payload: event as unknown as Json });
  if (error?.code === "23505") {
    const { data: existing } = await admin.from("mail_marketing_provider_events").select("processed_at").eq("provider_event_id", eventId).maybeSingle();
    if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  }
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  const now = new Date().toISOString();
  const patch = event.type === "email.delivered" ? { status: "delivered", delivered_at: now }
    : event.type === "email.bounced" ? { status: "bounced", bounced_at: now }
    : event.type === "email.complained" ? { status: "complained", complained_at: now } : null;
  if (patch && providerId) await admin.from("mail_marketing_deliveries").update(patch).eq("provider_message_id", providerId);
  if ((event.type === "email.bounced" || event.type === "email.complained") && event.data?.to?.[0]) {
    const email = event.data.to[0].toLowerCase();
    const { data: delivery } = providerId ? await admin.from("mail_marketing_deliveries").select("user_id").eq("provider_message_id", providerId).maybeSingle() : { data: null };
    await admin.from("mail_marketing_suppressions").upsert({ email, user_id: delivery?.user_id || null, reason: event.type === "email.complained" ? "complaint" : "bounce", source: "resend_webhook" });
    if (event.type === "email.complained" && delivery?.user_id) await admin.from("email_preferences").update({ unsubscribed_all: true, unsubscribed_at: now }).eq("user_id", delivery.user_id);
  }
  await admin.from("mail_marketing_provider_events").update({ processed_at: now }).eq("provider_event_id", eventId);
  return NextResponse.json({ ok: true });
}
