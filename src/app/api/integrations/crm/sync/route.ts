import { timingSafeEqual } from "node:crypto";
import { processNextHubSpotSyncPage } from "@/features/crm-integrations/server/hubspot-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (!expected || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const processed = [];
  for (let index = 0; index < 5; index += 1) {
    const result = await processNextHubSpotSyncPage();
    if (!result) break;
    processed.push(result);
    if (result.status === "queued" && "error" in result) break;
  }
  return Response.json({ processed }, { headers: { "Cache-Control": "no-store" } });
}
