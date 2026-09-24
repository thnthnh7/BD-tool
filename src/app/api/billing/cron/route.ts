import { NextRequest, NextResponse } from "next/server";
import { runBillingCron } from "@/lib/billing/actions";

export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runBillingCron();
  return NextResponse.json(result);
}
