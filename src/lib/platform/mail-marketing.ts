"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/auth/session";
import { recordPlatformAudit } from "@/lib/platform/audit";
import { providerReadiness } from "@/lib/mail-marketing/provider";
import { runMailMarketingWorker } from "@/lib/mail-marketing/engine";

export async function loadMailMarketing() {
  await requirePlatform("super_admin");
  const admin = createAdminClient();
  const [{ data: settings, error: settingsError }, { data: campaigns, error: campaignError }, { data: deliveries, error: deliveryError }, { data: suppressions }] = await Promise.all([
    admin.from("mail_marketing_settings").select("*").eq("id", 1).single(),
    admin.from("mail_marketing_campaigns").select("*").order("sort_order"),
    admin.from("mail_marketing_deliveries").select("*").order("created_at", { ascending: false }).limit(5000),
    admin.from("mail_marketing_suppressions").select("email").limit(5000),
  ]);
  if (settingsError) throw settingsError;
  if (campaignError) throw campaignError;
  if (deliveryError) throw deliveryError;
  const rows = deliveries || [];
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return { settings, campaigns: campaigns || [], deliveries: rows.slice(0, 50), readiness: providerReadiness(), suppressions: suppressions?.length || 0,
    metrics: { queued: count("queued") + count("failed"), sent: count("sent") + count("delivered"), delivered: count("delivered"), bounced: count("bounced"), complained: count("complained"), clicked: rows.filter((row) => row.clicked_at).length, returned: rows.filter((row) => row.returned_at).length } };
}

export async function updateMailMarketingSettingsAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const admin = createAdminClient();
  const { data: before } = await admin.from("mail_marketing_settings").select("*").eq("id", 1).single();
  const patch = {
    enabled: formData.get("enabled") === "on",
    sender_name: String(formData.get("sender_name") || "Bizcraw").trim(),
    sender_email: String(formData.get("sender_email") || "").trim().toLowerCase(),
    reply_to: String(formData.get("reply_to") || "").trim().toLowerCase(),
    daily_marketing_limit: Math.max(1, Math.min(10, Number(formData.get("daily_marketing_limit") || 1))),
    weekly_marketing_limit: Math.max(1, Math.min(30, Number(formData.get("weekly_marketing_limit") || 3))),
    updated_by: context.userId,
  };
  if (!/^\S+@\S+\.\S+$/.test(patch.sender_email) || (patch.reply_to && !/^\S+@\S+\.\S+$/.test(patch.reply_to))) throw new Error("Enter valid sender and reply-to addresses.");
  const { error } = await admin.from("mail_marketing_settings").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
  await recordPlatformAudit({ action: "mail_marketing.settings_updated", entityType: "mail_marketing_settings", entityId: "1", before: before || {}, after: patch });
  revalidatePath("/app/platform/mail-marketing");
}

export async function updateMailCampaignAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const id = String(formData.get("id") || "");
  const admin = createAdminClient();
  const { data: before } = await admin.from("mail_marketing_campaigns").select("*").eq("id", id).single();
  if (!before) throw new Error("Campaign not found.");
  const status = String(formData.get("status") || "paused");
  if (!['draft','active','paused','archived'].includes(status)) throw new Error("Invalid status.");
  const ctaPath = String(formData.get("cta_path") || "/app").trim();
  if (!ctaPath.startsWith("/") || ctaPath.startsWith("//")) throw new Error("CTA path must be an internal path.");
  const patch = { name: String(formData.get("name") || "").trim(), status, delay_hours: Math.max(0, Math.min(8760, Number(formData.get("delay_hours") || 0))), subject_template: String(formData.get("subject_template") || "").trim(), body_template: String(formData.get("body_template") || "").trim(), cta_label: String(formData.get("cta_label") || "Open Bizcraw").trim(), cta_path: ctaPath, updated_by: context.userId };
  if (!patch.name || !patch.subject_template || !patch.body_template) throw new Error("Name, subject and body are required.");
  const { error } = await admin.from("mail_marketing_campaigns").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await recordPlatformAudit({ action: "mail_marketing.campaign_updated", entityType: "mail_marketing_campaign", entityId: id, before, after: patch });
  revalidatePath("/app/platform/mail-marketing");
}

export async function runMailMarketingAction() {
  await requirePlatform("super_admin");
  const result = await runMailMarketingWorker();
  await recordPlatformAudit({ action: "mail_marketing.worker_run", entityType: "mail_marketing", after: result });
  revalidatePath("/app/platform/mail-marketing");
}
