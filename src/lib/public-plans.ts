import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { parsePlan, type ParsedPlan } from "@/lib/entitlements";
import { CAPABILITY_OPTIONS, MODULE_GROUPS } from "@/lib/module-catalog";

export type PublicPlan = ParsedPlan & { usdMonthlyCents: number | null };

function quotaLabel(limit: number, counted: string, unlimited: string) {
  return limit < 0 ? unlimited : counted;
}

export function planDetailHighlights(plan: ParsedPlan) {
  const lines: string[] = [];
  if (plan.trialDays > 0) lines.push(`${plan.trialDays}-day free trial`);
  lines.push(
    quotaLabel(plan.quotas.quotes_per_month, `${plan.quotas.quotes_per_month} quotes per month`, "Unlimited quotes"),
    quotaLabel(plan.quotas.ai_briefs_per_month, `${plan.quotas.ai_briefs_per_month} AI briefs per month`, "Unlimited AI briefs"),
  );
  return lines;
}

export function planIncludedModules(plan: ParsedPlan) {
  const modules: string[] = [];
  for (const group of MODULE_GROUPS) {
    for (const [key, label] of group.modules) {
      if (plan.features[key]) modules.push(label);
    }
  }
  const capabilities: string[] = [];
  for (const [key, label] of CAPABILITY_OPTIONS) {
    if (plan.features[key]) capabilities.push(label);
  }
  return [...modules, ...capabilities];
}

async function queryPublicPlans(): Promise<PublicPlan[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from("plans").select("*").eq("is_public", true).order("sort_order");
    if (error || !data) return [];
    const ids = data.map((row) => row.id);
    const { data: prices } = ids.length
      ? await supabase.from("billing_provider_prices").select("plan_id, amount").in("plan_id", ids).eq("active", true).eq("billing_interval", "monthly").eq("currency", "USD")
      : { data: [] };
    const monthlyCents = new Map<string, number>();
    for (const price of prices || []) if (!monthlyCents.has(price.plan_id)) monthlyCents.set(price.plan_id, price.amount);
    return data.map((row) => ({ ...parsePlan(row), usdMonthlyCents: monthlyCents.get(row.id) ?? null }));
  } catch {
    return [];
  }
}

export const loadPublicPlans = unstable_cache(queryPublicPlans, ["public-marketing-plans-v2"], {
  revalidate: 3600,
  tags: ["public-plans"],
});
