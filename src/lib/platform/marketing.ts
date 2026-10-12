import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { loadSearchConsole } from "@/lib/marketing/search-console";

type SessionRow = { id: string; visitor_id: string; landing_path: string; referrer_host: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; country_code: string | null; device_type: string; page_view_count: number; engagement_ms: number; started_at: string };
type EventRow = { session_id: string | null; workspace_id: string | null; event_name: string; path: string | null; label: string | null; metric_value: number | null; occurred_at: string };
type DailyRow = Database["public"]["Tables"]["marketing_daily_metrics"]["Row"];

function channel(row: SessionRow) {
  const source = (row.utm_source || row.referrer_host || "").toLowerCase();
  const medium = (row.utm_medium || "").toLowerCase();
  if (/chatgpt|openai|claude|perplexity|gemini|copilot/.test(source)) return "AI assistants";
  if (/google|bing|duckduckgo|yahoo/.test(source) && medium !== "paid" && medium !== "cpc") return "Organic search";
  if (/facebook|linkedin|instagram|x\.com|twitter|youtube|tiktok/.test(source)) return "Social";
  if (/paid|cpc|ppc|display/.test(medium)) return "Paid";
  if (row.referrer_host) return "Referral";
  if (row.utm_source) return "Campaign";
  return "Direct";
}

function summarize(sessions: SessionRow[], events: EventRow[]) {
  const visitors = new Set(sessions.map((row) => row.visitor_id)).size;
  const pageviews = sessions.reduce((sum, row) => sum + row.page_view_count, 0);
  const engaged = sessions.filter((row) => row.engagement_ms >= 10_000 || row.page_view_count >= 2).length;
  const eventCount = (name: string) => new Set(events.filter((row) => row.event_name === name).map((row) => row.session_id || row.workspace_id || row.occurred_at)).size;
  return {
    visitors, sessions: sessions.length, pageviews,
    pagesPerSession: sessions.length ? pageviews / sessions.length : 0,
    avgEngagementSeconds: sessions.length ? sessions.reduce((sum, row) => sum + row.engagement_ms, 0) / sessions.length / 1000 : 0,
    engagementRate: sessions.length ? engaged / sessions.length : 0,
    signups: eventCount("signup_started"), workspaces: eventCount("workspace_created"), checkoutStarted: eventCount("checkout_started"), checkoutFailed: eventCount("checkout_failed"), paid: eventCount("paid_activated"),
    sourcesInstalled: eventCount("source_installed"), firstScrapes: eventCount("first_scrape_succeeded"), firstCrmImports: eventCount("first_crm_import"),
  };
}

function weekStart(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export async function loadMarketingDashboard(days: number) {
  await requirePlatform("super_admin");
  const rangeDays = [7, 30, 90].includes(days) ? days : 30;
  const currentStart = new Date(Date.now() - rangeDays * 86_400_000);
  const previousStart = new Date(currentStart.getTime() - rangeDays * 86_400_000);
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  await admin.rpc("refresh_marketing_daily_metrics", { p_from: today, p_to: today });
  const [{ data: sessions, error: sessionError }, { data: events, error: eventError }, { data: daily, error: dailyError }, searchConsole] = await Promise.all([
    admin.from("marketing_sessions").select("id, visitor_id, landing_path, referrer_host, utm_source, utm_medium, utm_campaign, country_code, device_type, page_view_count, engagement_ms, started_at").gte("started_at", previousStart.toISOString()).order("started_at", { ascending: false }).limit(100000),
    admin.from("marketing_events").select("session_id, workspace_id, event_name, path, label, metric_value, occurred_at").gte("occurred_at", previousStart.toISOString()).order("occurred_at", { ascending: false }).limit(100000),
    admin.from("marketing_daily_metrics").select("*").gte("metric_date", currentStart.toISOString().slice(0, 10)).lte("metric_date", today).order("metric_date"),
    loadSearchConsole(rangeDays),
  ]);
  if (sessionError) throw sessionError;
  if (eventError) throw eventError;
  if (dailyError) throw dailyError;
  const allSessions = (sessions || []) as SessionRow[];
  const allEvents = (events || []) as EventRow[];
  const currentSessions = allSessions.filter((row) => new Date(row.started_at) >= currentStart);
  const previousSessions = allSessions.filter((row) => new Date(row.started_at) < currentStart);
  const currentEvents = allEvents.filter((row) => new Date(row.occurred_at) >= currentStart);
  const previousEvents = allEvents.filter((row) => new Date(row.occurred_at) < currentStart);

  const group = <T,>(rows: T[], key: (row: T) => string) => Object.entries(rows.reduce<Record<string, number>>((acc, row) => { const name = key(row) || "Unknown"; acc[name] = (acc[name] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const content = Object.values(currentSessions.reduce<Record<string, { path: string; sessions: number; pageviews: number; engagement: number; bounced: number }>>((acc, row) => {
    const item = acc[row.landing_path] ||= { path: row.landing_path, sessions: 0, pageviews: 0, engagement: 0, bounced: 0 };
    item.sessions += 1; item.pageviews += row.page_view_count; item.engagement += row.engagement_ms; if (row.engagement_ms < 10_000 && row.page_view_count < 2) item.bounced += 1; return acc;
  }, {})).sort((a, b) => b.pageviews - a.pageviews).slice(0, 12);
  const sessionById = new Map(currentSessions.map((row) => [row.id, row]));
  const attribution = Object.values(currentSessions.reduce<Record<string, { channel: string; sessions: number; workspaces: number; paid: number }>>((acc, row) => {
    const name = channel(row); const item = acc[name] ||= { channel: name, sessions: 0, workspaces: 0, paid: 0 }; item.sessions += 1; return acc;
  }, {}));
  const attributionByName = new Map(attribution.map((row) => [row.channel, row]));
  for (const event of currentEvents) {
    if (!event.session_id || (event.event_name !== "workspace_created" && event.event_name !== "paid_activated")) continue;
    const session = sessionById.get(event.session_id); if (!session) continue;
    const item = attributionByName.get(channel(session)); if (!item) continue;
    if (event.event_name === "workspace_created") item.workspaces += 1; else item.paid += 1;
  }
  const vital = (name: "LCP" | "INP" | "CLS", goodThreshold: number, unit: string) => {
    const values = currentEvents.filter((row) => row.event_name === "web_vital" && row.label === name && row.metric_value != null).map((row) => Number(row.metric_value)).sort((a, b) => a - b);
    const p75 = values.length ? values[Math.max(0, Math.ceil(values.length * 0.75) - 1)] : null;
    return { name, p75, goodThreshold, unit, sampleCount: values.length };
  };
  const workspaceEvents = allEvents.reduce<Map<string, EventRow[]>>((map, event) => {
    if (!event.workspace_id) return map;
    const rows = map.get(event.workspace_id) || [];
    rows.push(event); map.set(event.workspace_id, rows); return map;
  }, new Map());
  const cohortMap = currentEvents.filter((event) => event.event_name === "workspace_created" && event.workspace_id).reduce<Record<string, { week: string; workspaces: number; activated: number; paid: number }>>((map, created) => {
    const week = weekStart(created.occurred_at);
    const cohort = map[week] ||= { week, workspaces: 0, activated: 0, paid: 0 };
    cohort.workspaces += 1;
    const createdAt = new Date(created.occurred_at).getTime();
    const related = workspaceEvents.get(created.workspace_id!) || [];
    if (related.some((event) => { const elapsed = new Date(event.occurred_at).getTime() - createdAt; return ["source_installed", "first_scrape_succeeded", "first_crm_import"].includes(event.event_name) && elapsed >= 0 && elapsed <= 7 * 86_400_000; })) cohort.activated += 1;
    if (related.some((event) => { const elapsed = new Date(event.occurred_at).getTime() - createdAt; return event.event_name === "paid_activated" && elapsed >= 0 && elapsed <= 30 * 86_400_000; })) cohort.paid += 1;
    return map;
  }, {});

  return {
    days: rangeDays, current: summarize(currentSessions, currentEvents), previous: summarize(previousSessions, previousEvents),
    channels: group(currentSessions, channel).slice(0, 10),
    sources: group(currentSessions, (row) => row.utm_source || row.referrer_host || "Direct").slice(0, 12),
    campaigns: group(currentSessions.filter((row) => row.utm_campaign), (row) => row.utm_campaign || "").slice(0, 10),
    countries: group(currentSessions, (row) => row.country_code || "Unknown").slice(0, 10),
    devices: group(currentSessions, (row) => row.device_type).slice(0, 10), content,
    attribution: attribution.sort((a, b) => b.sessions - a.sessions), trend: (daily || []) as DailyRow[],
    webVitals: [vital("LCP", 2500, "ms"), vital("INP", 200, "ms"), vital("CLS", 0.1, "")],
    cohorts: Object.values(cohortMap).sort((a, b) => b.week.localeCompare(a.week)),
    searchConsole,
  };
}
