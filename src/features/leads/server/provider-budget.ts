"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin, requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function loadProviderBudget() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const start = new Date();
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const [{ data: budget }, { data: jobs }] = await Promise.all([
    supabase.from("workspace_provider_budgets").select("monthly_limit_usd").eq("workspace_id", context.workspaceId).eq("provider", "apify").maybeSingle(),
    supabase.from("lead_scrape_jobs").select("apify_usage_usd").eq("workspace_id", context.workspaceId).gte("created_at", start.toISOString()),
  ]);
  return { limitUsd: budget?.monthly_limit_usd == null ? null : Number(budget.monthly_limit_usd), usedUsd: (jobs || []).reduce((sum, job) => sum + Math.max(0, Number(job.apify_usage_usd || 0)), 0), canManage: context.memberRole !== "member" };
}

export async function saveProviderBudgetAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const raw = String(formData.get("monthly_limit_usd") || "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 1_000_000)) return { error: "Enter a monthly limit between 0 and 1,000,000 USD, or leave it blank for no limit." };
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_provider_budgets").upsert({ workspace_id: context.workspaceId, provider: "apify", monthly_limit_usd: limit, updated_by: context.userId, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}
