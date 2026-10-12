import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/auth/session";

type SessionRow = { id: string; visitor_id: string; landing_path: string; referrer_host: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; country_code: string | null; device_type: string; page_view_count: number; engagement_ms: number; started_at: string };
type EventRow = { session_id: string | null; workspace_id: string | null; event_name: string; path: string | null; label: string | null; occurred_at: string };

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
    signups: eventCount("signup_started"), workspaces: eventCount("workspace_created"), paid: eventCount("paid_activated"),
  };
}

export async function loadMarketingDashboard(days: number) {
  await requirePlatform("super_admin");
  const rangeDays = [7, 30, 90].includes(days) ? days : 30;
  const currentStart = new Date(Date.now() - rangeDays * 86_400_000);
  const previousStart = new Date(currentStart.getTime() - rangeDays * 86_400_000);
  const admin = createAdminClient();
  const [{ data: sessions, error: sessionError }, { data: events, error: eventError }] = await Promise.all([
    admin.from("marketing_sessions").select("id, visitor_id, landing_path, referrer_host, utm_source, utm_medium, utm_campaign, country_code, device_type, page_view_count, engagement_ms, started_at").gte("started_at", previousStart.toISOString()).order("started_at", { ascending: false }).limit(100000),
    admin.from("marketing_events").select("session_id, workspace_id, event_name, path, label, occurred_at").gte("occurred_at", previousStart.toISOString()).order("occurred_at", { ascending: false }).limit(100000),
  ]);
  if (sessionError) throw sessionError;
  if (eventError) throw eventError;
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

  return {
    days: rangeDays, current: summarize(currentSessions, currentEvents), previous: summarize(previousSessions, previousEvents),
    channels: group(currentSessions, channel).slice(0, 10),
    sources: group(currentSessions, (row) => row.utm_source || row.referrer_host || "Direct").slice(0, 12),
    campaigns: group(currentSessions.filter((row) => row.utm_campaign), (row) => row.utm_campaign || "").slice(0, 10),
    countries: group(currentSessions, (row) => row.country_code || "Unknown").slice(0, 10),
    devices: group(currentSessions, (row) => row.device_type).slice(0, 10), content,
  };
}
