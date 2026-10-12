import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { MARKETING_SESSION_COOKIE } from "@/lib/marketing/constants";

export type MarketingEventName = "page_view" | "engagement" | "scroll_depth" | "cta_click" | "signup_started";

export function analyticsSalt() {
  return process.env.MARKETING_ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function hashMarketingId(value: string) {
  const salt = analyticsSalt();
  if (!salt || !value) return "";
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function cleanMarketingPath(value: string) {
  const path = value.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 240) return "/";
  return path;
}

export async function linkMarketingSessionToWorkspace(workspaceId: string) {
  if (!hasServiceRole()) return;
  try {
    const cookieStore = await cookies();
    const rawSessionId = cookieStore.get(MARKETING_SESSION_COOKIE)?.value || "";
    const sessionId = hashMarketingId(rawSessionId);
    if (!sessionId) return;
    const admin = createAdminClient();
    await admin.from("marketing_sessions").update({ workspace_id: workspaceId }).eq("id", sessionId);
    await admin.from("marketing_events").upsert({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_name: "workspace_created",
      dedupe_key: `workspace_created:${workspaceId}`,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  } catch (error) {
    console.error("Marketing workspace conversion could not be recorded", error);
  }
}

export async function recordPaidMarketingConversion(workspaceId: string, subscriptionId: string) {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { data: session } = await admin.from("marketing_sessions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await admin.from("marketing_events").upsert({
      session_id: session?.id || null,
      workspace_id: workspaceId,
      event_name: "paid_activated",
      dedupe_key: `paid_activated:${subscriptionId}`,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  } catch (error) {
    console.error("Marketing paid conversion could not be recorded", error);
  }
}

export async function recordWorkspaceMarketingEvent(input: { workspaceId: string; eventName: "checkout_started" | "checkout_failed" | "source_installed" | "first_scrape_succeeded" | "first_crm_import"; dedupeKey: string; label?: string }) {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { data: session } = await admin.from("marketing_sessions").select("id").eq("workspace_id", input.workspaceId).order("started_at", { ascending: true }).limit(1).maybeSingle();
    await admin.from("marketing_events").upsert({ session_id: session?.id || null, workspace_id: input.workspaceId, event_name: input.eventName, label: input.label || null, dedupe_key: input.dedupeKey }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  } catch (error) {
    console.error(`Marketing ${input.eventName} event could not be recorded`, error);
  }
}
