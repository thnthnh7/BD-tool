import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runBillingCron } from "@/lib/billing/actions";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await runBillingCron();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
