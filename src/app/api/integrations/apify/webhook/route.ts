import { after, NextRequest, NextResponse } from "next/server";
import { claimScrapeIngest, fetchApifyRun, runScrapeIngest } from "@/features/leads/server/apify";
import { getApifyConnectionToken } from "@/features/leads/server/apify-connection";
import { recordHeartbeat } from "@/lib/platform/heartbeat";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId") || "";
  const secret = request.nextUrl.searchParams.get("secret") || "";
  if (!jobId || !secret) {
    await recordHeartbeat("apify_webhook", false, "missing job");
    return NextResponse.json({ error: "Missing job" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: job } = await supabase.from("lead_scrape_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || job.webhook_secret !== secret) {
    await recordHeartbeat("apify_webhook", false, "unauthorized");
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  if (job.status === "succeeded" && job.places_found > 0) {
    await recordHeartbeat("apify_webhook", true, "already_ingested");
    return NextResponse.json({ ok: true, status: "already_ingested" });
  }
  if (job.status === "ingesting") {
    await recordHeartbeat("apify_webhook", true, "in_progress");
    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  let payload: { eventType?: string; resource?: { defaultDatasetId?: string; id?: string; status?: string } } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const event = payload.eventType || "";
  const datasetId = payload.resource?.defaultDatasetId || job.apify_dataset_id;
  const runId = payload.resource?.id || job.apify_run_id;
  const failed = event.includes("FAILED") || event.includes("ABORTED") || event.includes("TIMED_OUT");

  if (failed) {
    let usageTotalUsd: number | null = null;
    if (runId && job.apify_connection_id) {
      try {
        const token = await getApifyConnectionToken(job.apify_connection_id);
        usageTotalUsd = (await fetchApifyRun(runId, token)).usageTotalUsd;
      } catch {
        // The run can briefly be unavailable while Apify is finalizing it.
      }
    }
    await supabase
      .from("lead_scrape_jobs")
      .update({
        status: "failed",
        error_message: event || "Apify run failed",
        finished_at: new Date().toISOString(),
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        apify_usage_usd: usageTotalUsd,
      })
      .eq("id", job.id)
      .in("status", ["queued", "running"]);
    await recordHeartbeat("apify_webhook", false, event || "failed");
    return NextResponse.json({ ok: true, status: "failed" });
  }

  if (!datasetId) {
    await supabase.from("lead_scrape_jobs").update({ status: "running", apify_run_id: runId }).eq("id", job.id).in("status", ["queued", "running"]);
    await recordHeartbeat("apify_webhook", true, "running");
    return NextResponse.json({ ok: true, status: "running" });
  }

  const claimed = await claimScrapeIngest(supabase, { jobId: job.id, datasetId, runId });
  if (claimed.busy || !claimed.job) {
    if (claimed.error && !claimed.busy) {
      await recordHeartbeat("apify_webhook", false, claimed.error);
      return NextResponse.json({ error: claimed.error }, { status: 500 });
    }
    await recordHeartbeat("apify_webhook", true, "in_progress");
    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  const claimedJob = claimed.job;
  after(async () => {
    await runScrapeIngest(claimedJob);
  });
  await recordHeartbeat("apify_webhook", true, "ingesting");
  return NextResponse.json({ ok: true, status: "ingesting" });
}
