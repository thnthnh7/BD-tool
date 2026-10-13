import { NextResponse } from "next/server";
import { runMailMarketingWorker } from "@/lib/mail-marketing/engine";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await runMailMarketingWorker()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Worker failed" }, { status: 500 }); }
}
