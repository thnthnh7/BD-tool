import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { parsePlan, type ParsedPlan } from "@/lib/entitlements";
import { CAPABILITY_OPTIONS, MODULE_GROUPS } from "@/lib/module-catalog";

export type PublicPlan = ParsedPlan & { usdMonthlyCents: number | null };

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

export function planFeatureGroups(plan: ParsedPlan) {
  const groups: Array<{ label: string; items: string[] }> = MODULE_GROUPS.map((group) => ({
    label: group.label,
    items: group.modules.filter(([key]) => plan.features[key]).map(([, label]) => String(label)),
  })).filter((group) => group.items.length > 0);
  const capabilities = CAPABILITY_OPTIONS.filter(([key]) => plan.features[key]).map(([, label]) => String(label));
  if (capabilities.length > 0) groups.push({ label: "Advanced", items: capabilities });
  return groups;
}

const PRIMARY_FEATURE_ORDER = [
  "Scraping",
  "Sources",
  "Leads",
  "Companies",
  "Contacts",
  "Deals",
  "Quotes",
  "AI Agent",
  "MCP",
  "Document export",
] as const;

export function planPrimaryFeatures(plan: ParsedPlan, limit = 5) {
  const included = planIncludedModules(plan);
  return [...included].sort((left, right) => {
    const leftIndex = PRIMARY_FEATURE_ORDER.indexOf(left as (typeof PRIMARY_FEATURE_ORDER)[number]);
    const rightIndex = PRIMARY_FEATURE_ORDER.indexOf(right as (typeof PRIMARY_FEATURE_ORDER)[number]);
    return (leftIndex < 0 ? PRIMARY_FEATURE_ORDER.length : leftIndex) - (rightIndex < 0 ? PRIMARY_FEATURE_ORDER.length : rightIndex);
  }).slice(0, limit);
}

async function queryPublicPlans(): Promise<PublicPlan[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from("plans").select("*").eq("is_public", true).order("sort_order");
    if (error || !data) return [];
    return data.map((row) => {
      const plan = parsePlan(row);
      return { ...plan, usdMonthlyCents: plan.isFree ? 0 : plan.priceMonthly || null };
    });
  } catch {
    return [];
  }
}

export const loadPublicPlans = unstable_cache(queryPublicPlans, ["public-marketing-plans-v3"], {
  revalidate: 3600,
  tags: ["public-plans"],
});
