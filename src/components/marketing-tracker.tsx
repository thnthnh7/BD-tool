"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { MARKETING_SESSION_COOKIE, MARKETING_VISITOR_COOKIE } from "@/lib/marketing/constants";

type Consent = "accepted" | "declined" | null;
const CONSENT_KEY = "bizcraw_marketing_consent";
const VISITOR_KEY = "bizcraw_marketing_visitor";
const SESSION_KEY = "bizcraw_marketing_session";
const SESSION_TOUCH_KEY = "bizcraw_marketing_session_touch";

function uuid() { return crypto.randomUUID(); }
function readStorage(storage: Storage, key: string) { try { return storage.getItem(key); } catch { return null; } }
function writeStorage(storage: Storage, key: string, value: string) { try { storage.setItem(key, value); } catch { /* storage may be blocked */ } }
function setCookie(name: string, value: string, maxAge: number) { document.cookie = `${name}=${value};path=/;max-age=${maxAge};samesite=lax${location.protocol === "https:" ? ";secure" : ""}`; }
function subscribeConsent(callback: () => void) { window.addEventListener("storage", callback); window.addEventListener("bizcraw-consent", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("bizcraw-consent", callback); }; }
function consentSnapshot() { return readStorage(localStorage, CONSENT_KEY) as Consent; }
function subscribeMounted() { return () => {}; }

function identity() {
  let visitorId = readStorage(localStorage, VISITOR_KEY);
  if (!visitorId) { visitorId = uuid(); writeStorage(localStorage, VISITOR_KEY, visitorId); }
  const lastTouch = Number(readStorage(sessionStorage, SESSION_TOUCH_KEY) || 0);
  let sessionId = readStorage(sessionStorage, SESSION_KEY);
  if (!sessionId || Date.now() - lastTouch > 30 * 60_000) { sessionId = uuid(); writeStorage(sessionStorage, SESSION_KEY, sessionId); }
  writeStorage(sessionStorage, SESSION_TOUCH_KEY, String(Date.now()));
  setCookie(MARKETING_VISITOR_COOKIE, visitorId, 365 * 24 * 60 * 60);
  setCookie(MARKETING_SESSION_COOKIE, sessionId, 30 * 60);
  return { visitorId, sessionId };
}

function send(event: string, path: string, values: Record<string, unknown> = {}, beacon = false) {
  const ids = identity();
  const params = new URLSearchParams(location.search);
  const body = JSON.stringify({ ...ids, event, path, referrer: document.referrer, utm: { source: params.get("utm_source") || undefined, medium: params.get("utm_medium") || undefined, campaign: params.get("utm_campaign") || undefined, content: params.get("utm_content") || undefined, term: params.get("utm_term") || undefined }, ...values });
  if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/marketing/events", new Blob([body], { type: "application/json" }));
  else void fetch("/api/marketing/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
}

export function MarketingTracker() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, () => null);
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const visibleAt = useRef(0);
  const engaged = useRef(0);
  const maxScroll = useRef(0);
  const publicPath = !pathname.startsWith("/app") && !pathname.startsWith("/api") && !pathname.startsWith("/auth") && !pathname.startsWith("/onboarding");

  useEffect(() => {
    if (consent !== "accepted" || !publicPath) return;
    visibleAt.current = document.visibilityState === "visible" ? Date.now() : 0; engaged.current = 0; maxScroll.current = 0;
    send("page_view", pathname);
    if (pathname === "/pricing") send("pricing_viewed", pathname);
    const visibility = () => {
      if (document.visibilityState === "visible") visibleAt.current = Date.now();
      else if (visibleAt.current) { engaged.current += Date.now() - visibleAt.current; visibleAt.current = 0; }
    };
    let lcp: number | undefined;
    let cls = 0;
    let inp: number | undefined;
    let vitalsSent = false;
    const observers: PerformanceObserver[] = [];
    try {
      const observer = new PerformanceObserver((list) => { const entries = list.getEntries(); const last = entries.at(-1); if (last) lcp = last.startTime; });
      observer.observe({ type: "largest-contentful-paint", buffered: true }); observers.push(observer);
    } catch { /* unsupported browser */ }
    try {
      const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) if (!entry.hadRecentInput) cls += entry.value || 0; });
      observer.observe({ type: "layout-shift", buffered: true }); observers.push(observer);
    } catch { /* unsupported browser */ }
    try {
      const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) inp = Math.max(inp || 0, entry.duration); });
      observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit); observers.push(observer);
    } catch { /* unsupported browser */ }
    const scroll = () => { const height = document.documentElement.scrollHeight - innerHeight; maxScroll.current = Math.max(maxScroll.current, height > 0 ? Math.round((scrollY / height) * 100) : 100); };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (pathname === "/pricing" && /signup|billing|plan=/i.test(href)) send("plan_selected", pathname, { label: href.slice(0, 80) });
      if (/signup|pricing|contact|mcp/i.test(href)) send(/signup/.test(href) ? "signup_started" : "cta_click", pathname, { label: href.slice(0, 80) });
    };
    const flush = () => {
      if (visibleAt.current) { engaged.current += Date.now() - visibleAt.current; visibleAt.current = Date.now(); }
      if (engaged.current >= 1000) send("engagement", pathname, { engagementMs: Math.min(engaged.current, 1_800_000) }, true);
      if (maxScroll.current > 0) send("scroll_depth", pathname, { scrollDepth: maxScroll.current }, true);
      if (!vitalsSent) {
        if (lcp !== undefined) send("web_vital", pathname, { label: "LCP", metricValue: lcp }, true);
        send("web_vital", pathname, { label: "CLS", metricValue: cls }, true);
        if (inp !== undefined) send("web_vital", pathname, { label: "INP", metricValue: inp }, true);
        vitalsSent = true;
      }
    };
    document.addEventListener("visibilitychange", visibility); addEventListener("scroll", scroll, { passive: true }); document.addEventListener("click", click); addEventListener("pagehide", flush);
    return () => { flush(); observers.forEach((observer) => observer.disconnect()); document.removeEventListener("visibilitychange", visibility); removeEventListener("scroll", scroll); document.removeEventListener("click", click); removeEventListener("pagehide", flush); };
  }, [consent, pathname, publicPath]);

  if (!mounted || !publicPath) return null;
  const locale = decodeURIComponent(document.cookie.match(/(?:^|;\s*)leadely-locale=([^;]+)/)?.[1] || navigator.language || "en");
  const copy = locale.toLowerCase().startsWith("vi")
    ? { preferences: "Tùy chọn phân tích", title: "Giúp Bizcraw cải thiện tốt hơn", description: "Khi bạn đồng ý, chúng tôi thu thập ẩn danh lượt xem trang và mức độ tương tác. Chúng tôi không lưu địa chỉ IP, nội dung biểu mẫu, câu lệnh, token hoặc dữ liệu workspace của bạn.", decline: "Từ chối", allow: "Cho phép phân tích" }
    : { preferences: "Analytics preferences", title: "Help us improve Bizcraw", description: "With your permission, we collect anonymous page visits and engagement. We do not store your IP address, form contents, prompts, tokens, or workspace data.", decline: "Decline", allow: "Allow analytics" };
  const notify = () => window.dispatchEvent(new Event("bizcraw-consent"));
  const choose = (value: Exclude<Consent, null>) => { writeStorage(localStorage, CONSENT_KEY, value); notify(); };
  if (consent !== null) return pathname === "/privacy" ? <Button size="compact-xs" variant="subtle" color="gray" pos="fixed" bottom={8} left={8} style={{ zIndex: 10000 }} onClick={() => { try { localStorage.removeItem(CONSENT_KEY); } catch { /* storage may be blocked */ } notify(); }}>{copy.preferences}</Button> : null;
  return <Paper shadow="lg" radius="md" p="md" withBorder pos="fixed" bottom={16} left={16} right={16} maw={620} style={{ zIndex: 10000 }}><Stack gap="xs"><Text fw={700}>{copy.title}</Text><Text size="sm" c="dimmed">{copy.description}</Text><Group justify="flex-end"><Button variant="subtle" color="gray" onClick={() => choose("declined")}>{copy.decline}</Button><Button onClick={() => choose("accepted")}>{copy.allow}</Button></Group></Stack></Paper>;
}
