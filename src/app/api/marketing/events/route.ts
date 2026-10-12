import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { cleanMarketingPath, hashMarketingId } from "@/lib/marketing/analytics";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  event: z.enum(["page_view", "engagement", "scroll_depth", "cta_click", "pricing_viewed", "plan_selected", "signup_started", "web_vital"]),
  path: z.string().min(1).max(240),
  label: z.string().max(80).optional(),
  referrer: z.string().max(500).optional(),
  utm: z.object({ source: z.string().max(100).optional(), medium: z.string().max(100).optional(), campaign: z.string().max(150).optional(), content: z.string().max(150).optional(), term: z.string().max(150).optional() }).optional(),
  engagementMs: z.number().int().min(0).max(1_800_000).optional(),
  scrollDepth: z.number().int().min(0).max(100).optional(),
  metricValue: z.number().min(0).max(1_000_000).optional(),
});

function referrerHost(value?: string) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "bizcraw.com" || host === "www.bizcraw.com" ? null : host.slice(0, 160);
  } catch { return null; }
}

function deviceType(agent: string) {
  if (/bot|crawler|spider|slurp/i.test(agent)) return "bot";
  if (/ipad|tablet/i.test(agent)) return "tablet";
  if (/mobile|android|iphone/i.test(agent)) return "mobile";
  return "desktop";
}

function browserName(agent: string) {
  if (/edg\//i.test(agent)) return "edge";
  if (/firefox\//i.test(agent)) return "firefox";
  if (/chrome\//i.test(agent)) return "chrome";
  if (/safari\//i.test(agent)) return "safari";
  return "other";
}

export async function POST(request: Request) {
  if (!hasServiceRole()) return NextResponse.json({ ok: false }, { status: 503 });
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : requestOrigin;
  let suppliedOrigin = "";
  try { suppliedOrigin = origin ? new URL(origin).origin : ""; } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
  if (suppliedOrigin && suppliedOrigin !== requestOrigin && suppliedOrigin !== siteOrigin) return NextResponse.json({ ok: false }, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ ok: false }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) return NextResponse.json({ ok: false }, { status: 413 });

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const data = parsed.data;
  const path = cleanMarketingPath(data.path);
  if (path.startsWith("/app") || path.startsWith("/api") || path.startsWith("/auth")) return NextResponse.json({ ok: false }, { status: 400 });
  const userAgent = request.headers.get("user-agent") || "";
  const device = deviceType(userAgent);
  if (device === "bot") return NextResponse.json({ ok: true });
  const sessionId = hashMarketingId(data.sessionId);
  const visitorId = hashMarketingId(data.visitorId);
  if (!sessionId || !visitorId) return NextResponse.json({ ok: false }, { status: 503 });

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_marketing_event", {
    p_session_id: sessionId, p_visitor_id: visitorId, p_event_name: data.event, p_path: path,
    p_label: data.label || null, p_referrer_host: referrerHost(data.referrer),
    p_utm_source: data.utm?.source || null, p_utm_medium: data.utm?.medium || null,
    p_utm_campaign: data.utm?.campaign || null, p_utm_content: data.utm?.content || null,
    p_utm_term: data.utm?.term || null, p_country_code: (request.headers.get("x-vercel-ip-country") || "").slice(0, 2) || null,
    p_device_type: device, p_browser: browserName(userAgent), p_engagement_ms: data.engagementMs || null,
    p_scroll_depth: data.scrollDepth || null, p_metric_value: data.metricValue ?? null, p_occurred_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 202 });
}
