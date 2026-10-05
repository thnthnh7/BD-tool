import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { parsePlan, type ParsedPlan } from "@/lib/entitlements";

export type PublicPlan = ParsedPlan & { usdMonthlyCents: number | null };

function quotaLabel(limit: number, counted: string, unlimited: string) {
  return limit < 0 ? unlimited : counted;
}

export function planHighlights(plan: ParsedPlan) {
  const lines = [
    quotaLabel(plan.quotas.quotes_per_month, `${plan.quotas.quotes_per_month} quotes per month`, "Unlimited quotes"),
    quotaLabel(plan.quotas.ai_briefs_per_month, `${plan.quotas.ai_briefs_per_month} AI actions per month`, "Unlimited AI actions"),
  ];
  const features: Array<[boolean, string]> = [
    [plan.features.lead_scrape, "Lead scraping"],
    [plan.features.byok_ai, "Bring your own AI key"],
    [plan.features.export_docx, "Document export"],
    [plan.features.contracts, "Contracts"],
    [plan.features.custom_branding, "Custom branding"],
    [plan.features.mcp_access, "MCP access"],
  ];
  for (const [enabled, label] of features) if (enabled) lines.push(label);
  return lines;
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
