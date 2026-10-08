import { NextRequest, NextResponse } from "next/server";
import { runEngagementWorker } from "@/features/comms/server/sequence-engine";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET || "";
  const received = request.headers.get("authorization") || "";
  if (!expected || received !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runEngagementWorker()) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Engagement worker failed" }, { status: 500 });
  }
}
