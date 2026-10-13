import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryAllowed, renderTemplate, triggerEligible, type LifecycleTrigger } from "@/lib/mail-marketing/rules";
import { emailHtml, sendLifecycleEmail } from "@/lib/mail-marketing/provider";
import { signMailToken } from "@/lib/mail-marketing/tokens";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const time = (value: string | null | undefined) => value ? new Date(value).getTime() : null;

export async function scheduleLifecycleEmails() {
  const admin = createAdminClient();
  const [{ data: campaigns, error: campaignError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    admin.from("mail_marketing_campaigns").select("*").eq("status", "active").order("sort_order"),
    admin.from("beta_campaign_enrollments").select("*").eq("status", "active"),
  ]);
  if (campaignError) throw campaignError;
  if (enrollmentError) throw enrollmentError;
  if (!campaigns?.length || !enrollments?.length) return 0;
  const userIds = [...new Set(enrollments.map((row) => row.user_id))];
  const workspaceIds = [...new Set(enrollments.map((row) => row.workspace_id))];
  const campaignIds = [...new Set(enrollments.map((row) => row.campaign_id))];
  const [{ data: profiles }, { data: preferences }, { data: activity }, { data: events }, { data: betaCampaigns }] = await Promise.all([
    admin.from("profiles").select("id,email,display_name").in("id", userIds),
    admin.from("email_preferences").select("*").in("user_id", userIds),
    admin.from("user_product_activity").select("*").in("workspace_id", workspaceIds),
    admin.from("marketing_events").select("workspace_id,event_name,occurred_at").in("workspace_id", workspaceIds).in("event_name", ["source_installed", "first_scrape_succeeded"]),
    admin.from("beta_campaigns").select("id,max_participants").in("id", campaignIds),
  ]);
  const profileMap = new Map((profiles || []).map((row) => [row.id, row]));
  const prefMap = new Map((preferences || []).map((row) => [row.user_id, row]));
  const activityMap = new Map((activity || []).map((row) => [`${row.user_id}:${row.workspace_id}`, row]));
  const eventMap = new Map<string, Record<string, string>>();
  const capacityMap = new Map((betaCampaigns || []).map((row) => [row.id, row.max_participants]));
  for (const event of events || []) {
    if (!event.workspace_id) continue;
    const entry = eventMap.get(event.workspace_id) || {};
    if (!entry[event.event_name] || entry[event.event_name] > event.occurred_at) entry[event.event_name] = event.occurred_at;
    eventMap.set(event.workspace_id, entry);
  }
  const now = Date.now();
  const inserts = [];
  for (const enrollment of enrollments) {
    const profile = profileMap.get(enrollment.user_id);
    const prefs = prefMap.get(enrollment.user_id) || { product_tips: false, beta_updates: false, announcements: false, unsubscribed_all: false };
    if (!profile?.email) continue;
    const userActivity = activityMap.get(`${enrollment.user_id}:${enrollment.workspace_id}`);
    const workspaceEvents = eventMap.get(enrollment.workspace_id) || {};
    const facts = { grantedAt: time(enrollment.granted_at)!, accessEndsAt: time(enrollment.access_ends_at)!, lastSeenAt: time(userActivity?.last_seen_at), sourceInstalledAt: time(workspaceEvents.source_installed), firstScrapeAt: time(workspaceEvents.first_scrape_succeeded) };
    for (const campaign of campaigns) {
      if (!categoryAllowed(campaign.category, prefs) || !triggerEligible(campaign.trigger_key as LifecycleTrigger, campaign.delay_hours, facts, now)) continue;
      const daysLeft = Math.max(0, Math.ceil((facts.accessEndsAt - now) / 86_400_000));
      inserts.push({
        campaign_id: campaign.id, user_id: enrollment.user_id, workspace_id: enrollment.workspace_id, beta_enrollment_id: enrollment.id,
        to_email: profile.email, to_name: profile.display_name || "", dedupe_key: `${campaign.id}:${enrollment.user_id}:${enrollment.id}`,
        variables: { first_name: (profile.display_name || profile.email.split("@")[0]).split(" ")[0], position: enrollment.position, capacity: capacityMap.get(enrollment.campaign_id) || 200, access_ends: new Date(enrollment.access_ends_at).toLocaleDateString("en-US", { dateStyle: "long" }), days_left: daysLeft },
      });
    }
  }
  if (!inserts.length) return 0;
  const { data, error } = await admin.from("mail_marketing_deliveries").upsert(inserts, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data?.length || 0;
}

export async function dispatchLifecycleQueue(limit = 20) {
  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin.from("mail_marketing_settings").select("*").eq("id", 1).single();
  if (settingsError) throw settingsError;
  if (!settings.enabled || !process.env.RESEND_API_KEY) return { claimed: 0, sent: 0, skipped: 0 };
  const { data: deliveries, error } = await admin.rpc("claim_mail_marketing_deliveries", { p_limit: limit });
  if (error) throw error;
  let sent = 0, skipped = 0;
  for (const delivery of deliveries || []) {
    try {
      const [{ data: campaign }, { data: prefs }, { data: suppression }, { count: daily }, { count: weekly }] = await Promise.all([
        admin.from("mail_marketing_campaigns").select("*").eq("id", delivery.campaign_id).single(),
        admin.from("email_preferences").select("*").eq("user_id", delivery.user_id).single(),
        admin.from("mail_marketing_suppressions").select("email").eq("email", delivery.to_email.toLowerCase()).maybeSingle(),
        admin.from("mail_marketing_deliveries").select("id", { count: "exact", head: true }).eq("user_id", delivery.user_id).in("status", ["sent", "delivered"]).gte("sent_at", new Date(Date.now() - 86_400_000).toISOString()),
        admin.from("mail_marketing_deliveries").select("id", { count: "exact", head: true }).eq("user_id", delivery.user_id).in("status", ["sent", "delivered"]).gte("sent_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
      ]);
      if (!campaign || !prefs || suppression || !categoryAllowed(campaign.category, prefs) || (campaign.category !== "service" && ((daily || 0) >= settings.daily_marketing_limit || (weekly || 0) >= settings.weekly_marketing_limit))) {
        await admin.from("mail_marketing_deliveries").update({ status: "canceled", last_error: suppression ? "suppressed" : "preference_or_frequency_cap" }).eq("id", delivery.id);
        skipped += 1; continue;
      }
      const variables = delivery.variables as Record<string, string | number>;
      const subject = renderTemplate(campaign.subject_template, variables);
      const body = renderTemplate(campaign.body_template, variables);
      const exp = Date.now() + 180 * 86_400_000;
      const base = { userId: delivery.user_id, email: delivery.to_email, exp };
      const unsubscribe = `${siteUrl()}/api/mail-marketing/unsubscribe?token=${encodeURIComponent(signMailToken({ ...base, purpose: "unsubscribe" }))}`;
      const preferences = `${siteUrl()}/email-preferences?token=${encodeURIComponent(signMailToken({ ...base, purpose: "preferences" }))}`;
      const click = `${siteUrl()}/api/mail-marketing/click?token=${encodeURIComponent(signMailToken({ ...base, purpose: "click", deliveryId: delivery.id, path: campaign.cta_path }))}`;
      const providerId = await sendLifecycleEmail({ fromName: settings.sender_name, fromEmail: settings.sender_email, replyTo: settings.reply_to, to: delivery.to_email, subject, html: emailHtml({ body, ctaLabel: campaign.cta_label, clickUrl: click, preferencesUrl: preferences, unsubscribeUrl: unsubscribe }), unsubscribeUrl: unsubscribe });
      await admin.from("mail_marketing_deliveries").update({ status: "sent", provider_message_id: providerId, subject_rendered: subject, sent_at: new Date().toISOString(), last_error: null }).eq("id", delivery.id);
      sent += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown send error";
      const terminal = delivery.attempt_count >= delivery.max_attempts;
      await admin.from("mail_marketing_deliveries").update({ status: terminal ? "canceled" : "failed", last_error: message.slice(0, 500), available_at: new Date(Date.now() + Math.min(24, 2 ** delivery.attempt_count) * 3_600_000).toISOString() }).eq("id", delivery.id);
    }
  }
  return { claimed: deliveries?.length || 0, sent, skipped };
}

export async function runMailMarketingWorker() {
  const scheduled = await scheduleLifecycleEmails();
  const dispatched = await dispatchLifecycleQueue();
  return { scheduled, ...dispatched };
}
