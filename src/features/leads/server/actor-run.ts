import "server-only";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { withWorkspace } from "@/lib/events";
import { incrementUsage } from "@/lib/usage";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { actorSecretFieldNames, readableActorFields, unsupportedActorFields, validateActorInputObject, validateActorJsonInput } from "@/features/leads/actor-input";
import { requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";
import { startApifyActorRun } from "@/features/leads/server/apify";
import { ensureSourceContract } from "@/features/leads/server/actor-schema";

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
  return (raw.startsWith("http") ? raw : `https://${raw}`).replace(/\/$/, "");
}

export async function startActorScrapeWithInput(input: {
  sourceId: string;
  contractHash: string;
  actorBuildId: string;
  normalizedInput: Record<string, unknown>;
  pricingBasis: Json;
  guideSourceVersions?: Json;
  jsonFallback?: boolean;
}) {
  if (!(await isPlatformFlagEnabled("scrape_enabled"))) return { error: "Scrape đang tạm dừng." };
  const { context, supabase } = await withWorkspace();
  if (!context.plan.features.lead_scrape) return { error: "Gói hiện tại không gồm lead scrape." };
  let apify;
  try { apify = await requireWorkspaceApifyConnection(context.workspaceId); }
  catch (error) { return { error: error instanceof Error ? error.message : "Workspace chưa kết nối Apify." }; }
  const refreshed = await ensureSourceContract(input.sourceId, apify.token, true);
  if (refreshed.error) return { error: `Actor definition could not be verified: ${refreshed.error}` };
  const { data: source } = await supabase.from("scrape_sources")
    .select("id, slug, title, archived_at, input_schema, contract_hash, actor_build_id, pricing_model, pricing_info")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (!source || source.archived_at || !source.input_schema || !source.contract_hash) return { error: "Actor definition is unavailable." };
  const { data: installed } = await supabase.from("workspace_scrape_sources")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("source_id", source.id)
    .maybeSingle();
  if (!installed) return { error: "Hãy cài nguồn này trước." };
  if (source.contract_hash !== input.contractHash || source.actor_build_id !== input.actorBuildId) {
    return { error: "The Actor definition changed. The approval expired; build a new preview." };
  }
  const currentPricing = { model: source.pricing_model, info: source.pricing_info || null, contractHash: source.contract_hash };
  if (JSON.stringify(currentPricing) !== JSON.stringify(input.pricingBasis)) {
    return { error: "The Actor pricing basis changed. The approval expired; build a new preview." };
  }
  const fields = readableActorFields(source.input_schema, null);
  const unsupportedRequired = unsupportedActorFields(source.input_schema).filter((field) => field.required);
  if (unsupportedRequired.length && !input.jsonFallback) return { error: `Actor này có trường bắt buộc chưa được hỗ trợ: ${unsupportedRequired.map((field) => field.label).join(", ")}.` };
  if (input.jsonFallback && actorSecretFieldNames(source.input_schema).some((name) => Object.prototype.hasOwnProperty.call(input.normalizedInput, name))) {
    return { error: "Secret Actor fields cannot be persisted through JSON fallback." };
  }
  let normalized: Record<string, unknown>;
  if (input.jsonFallback) {
    const validation = validateActorJsonInput(source.input_schema, input.normalizedInput);
    if (!validation.valid) return { error: validation.error };
    normalized = input.normalizedInput;
  } else {
    const validation = validateActorInputObject(fields, input.normalizedInput);
    if ("error" in validation) return { error: validation.error || "Actor input is invalid." };
    normalized = validation.body;
  }
  const inputHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  const summary = Object.values(normalized).find((value) => typeof value === "string" && value.trim());
  const { data: job, error } = await supabase.from("lead_scrape_jobs").insert({
    workspace_id: context.workspaceId,
    created_by: context.userId,
    source_id: source.id,
    apify_actor_id: source.slug,
    apify_connection_id: apify.connection.id,
    apify_account_id: apify.connection.apify_user_id,
    apify_account_username: apify.connection.apify_username,
    query: typeof summary === "string" ? summary.slice(0, 180) : source.title,
    location: "",
    language: context.locale,
    max_results: 20,
    filters: normalized as Json,
    status: "queued",
    pdpa_confirmed: true,
    actor_contract_hash: source.contract_hash,
    actor_build_id: source.actor_build_id,
    actor_input_hash: inputHash,
    pricing_basis: currentPricing as Json,
    actor_validation_result: { valid: true, validated_at: new Date().toISOString() },
    guide_source_versions: input.guideSourceVersions || {},
  }).select("*").single();
  if (error?.code === "23505") return { error: "Workspace đang có một lượt scrape chưa xong." };
  if (error || !job) return { error: error?.message || "Không tạo được job." };
  const quota = await incrementUsage(supabase, context.workspaceId, "maps_scrapes", 1, -1);
  if (quota.error) {
    await supabase.from("lead_scrape_jobs").delete().eq("id", job.id).eq("workspace_id", context.workspaceId);
    return quota;
  }
  try {
    const webhookUrl = `${siteUrl()}/api/integrations/apify/webhook?jobId=${job.id}&secret=${job.webhook_secret}`;
    const run = await startApifyActorRun({ actorSlug: source.slug, body: normalized, webhookUrl, token: apify.token });
    await supabase.from("lead_scrape_jobs").update({
      status: "running",
      apify_run_id: run.runId,
      apify_dataset_id: run.datasetId,
      started_at: new Date().toISOString(),
    }).eq("id", job.id);
    await supabase.from("actor_guidance_events").insert({
      workspace_id: context.workspaceId,
      user_id: context.userId,
      source_id: source.id,
      event_type: "run_started_after_guidance",
      metadata: { sourceType: "agent_approval" },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Không start được Apify.";
    await supabase.from("lead_scrape_jobs").update({ status: "failed", error_message: message }).eq("id", job.id);
    return { error: message, id: job.id };
  }
  revalidatePath("/app/leads/scrape");
  return { ok: true as const, id: job.id };
}
