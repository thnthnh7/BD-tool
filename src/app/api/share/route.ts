import { NextRequest, NextResponse } from "next/server";
import { slimSharedPayload, type SharedQuotePayload } from "@/lib/share";
import { saveSharedQuote } from "@/lib/share-store";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestLog = new Map<string, number[]>();

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const active = (requestLog.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  active.push(now);
  requestLog.set(ip, active);
  return active.length > MAX_REQUESTS_PER_WINDOW;
}

function isPayload(value: unknown): value is SharedQuotePayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return Boolean(body.settings && body.quote);
}

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: "Too many share requests. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPayload(body)) {
    return NextResponse.json({ error: "Missing settings or quote" }, { status: 400 });
  }

  try {
    const id = await saveSharedQuote(slimSharedPayload(body, { stripDataLogos: false }));
    const origin = request.nextUrl.origin;
    return NextResponse.json({ id, url: `${origin}/p/${id}` });
  } catch (error) {
    console.error("Share create failed:", error);
    return NextResponse.json({ error: "Failed to create short link" }, { status: 500 });
  }
}
