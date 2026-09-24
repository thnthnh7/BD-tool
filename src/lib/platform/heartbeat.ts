import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export type HeartbeatKind = "billing_cron" | "sepay_webhook" | "apify_webhook";

export async function recordHeartbeat(kind: HeartbeatKind, ok: boolean, detail: string) {
  if (!hasServiceRole()) return;
  const admin = createAdminClient();
  const { error } = await admin.from("integration_heartbeats").insert({
    kind,
    ok,
    detail: detail.slice(0, 500),
  });
  if (error) console.error("heartbeat", error.message);
}
