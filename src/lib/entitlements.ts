export type PlanQuotas = {
  seats: number;
  quotes_per_month: number;
  ai_briefs_per_month: number;
  concurrent_scrape_runs: number;
  raw_data_retention_days: number;
};

export type PlanFeatures = {
  sources: boolean;
  scraping: boolean;
  data_library: boolean;
  leads: boolean;
  lists: boolean;
  companies: boolean;
  contacts: boolean;
  deals: boolean;
  tasks: boolean;
  quotes: boolean;
  product_modules: boolean;
  inbox: boolean;
  calendar: boolean;
  sequences: boolean;
  team: boolean;
  crm_integrations: boolean;
  export_docx: boolean;
  custom_branding: boolean;
  contracts: boolean;
  byok_ai: boolean;
  ai_agent: boolean;
  /** @deprecated Use `scraping`. Kept while existing callers are migrated. */
  lead_scrape: boolean;
  mcp_access: boolean;
};

export type ParsedPlan = {
  id: string;
  slot: number;
  name: string;
  slug: string;
  isPublic: boolean;
  isFree: boolean;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  quotas: PlanQuotas;
  features: PlanFeatures;
  sortOrder: number;
  badge: string;
};

export type EntitlementSnapshot = {
  version: number;
  quotas: PlanQuotas;
  features: PlanFeatures;
};

export function createEntitlementSnapshot(plan: ParsedPlan, version = 1): EntitlementSnapshot {
  return { version, quotas: { ...plan.quotas }, features: { ...plan.features } };
}

export function applyEntitlementSnapshot(plan: ParsedPlan, snapshot: unknown): ParsedPlan {
  if (!snapshot || typeof snapshot !== "object") return plan;
  const value = snapshot as Partial<EntitlementSnapshot>;
  return applyPlanOverrides(plan, value.quotas, value.features);
}

export function parsePlan(row: {
  id: string;
  slot: number;
  name: string;
  slug: string;
  is_public: boolean;
  is_free: boolean;
  price_monthly: number;
  price_yearly: number;
  trial_days: number;
  quotas: unknown;
  features: unknown;
  sort_order: number;
  badge: string;
}): ParsedPlan {
  const quotas = (row.quotas || {}) as Partial<PlanQuotas>;
  const features = (row.features || {}) as Partial<PlanFeatures>;
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    slug: row.slug,
    isPublic: row.is_public,
    isFree: row.is_free,
    priceMonthly: row.price_monthly,
    priceYearly: row.price_yearly,
    trialDays: row.trial_days,
    quotas: {
      seats: Number(quotas.seats ?? 1),
      quotes_per_month: Number(quotas.quotes_per_month ?? 0),
      // AI usage is metered for operations and abuse detection, but is never a
      // commercial plan quota. Keep the legacy key in snapshots while always
      // interpreting it as unlimited.
      ai_briefs_per_month: -1,
      concurrent_scrape_runs: Math.max(1, Number(quotas.concurrent_scrape_runs ?? 1)),
      raw_data_retention_days: Math.max(1, Number(quotas.raw_data_retention_days ?? 7)),
    },
    features: {
      sources: feature(features, "sources", false),
      scraping: feature(features, "scraping", feature(features, "lead_scrape", false)),
      data_library: feature(features, "data_library", false),
      leads: feature(features, "leads", false),
      lists: feature(features, "lists", false),
      companies: feature(features, "companies", false),
      contacts: feature(features, "contacts", false),
      deals: feature(features, "deals", false),
      tasks: feature(features, "tasks", false),
      quotes: feature(features, "quotes", false),
      product_modules: feature(features, "product_modules", false),
      inbox: feature(features, "inbox", false),
      calendar: feature(features, "calendar", false),
      sequences: feature(features, "sequences", false),
      team: feature(features, "team", false),
      crm_integrations: feature(features, "crm_integrations", false),
      export_docx: Boolean(features.export_docx),
      // Branding is available to every workspace and is no longer a paid
      // plan differentiator. Keep the legacy key in the contract so older
      // snapshots remain readable.
      custom_branding: true,
      contracts: Boolean(features.contracts),
      byok_ai: Boolean(features.byok_ai),
      ai_agent: feature(features, "ai_agent", false),
      lead_scrape: feature(features, "scraping", feature(features, "lead_scrape", false)),
      mcp_access: Boolean(features.mcp_access),
    },
    sortOrder: row.sort_order,
    badge: row.badge,
  };
}

export type PlanStatus = "pending" | "trialing" | "active" | "past_due" | "suspended" | "expired" | "canceled";

export function isPlanLocked(status: PlanStatus) {
  return status === "pending" || status === "suspended" || status === "expired" || status === "canceled";
}

export function canUsePaidFeatures(status: PlanStatus) {
  return status === "trialing" || status === "active" || status === "past_due";
}

export function quotaReached(used: number, limit: number) {
  if (limit < 0) return false;
  return used >= limit;
}

export function applyPlanOverrides(
  plan: ParsedPlan,
  quotas: unknown,
  features: unknown,
): ParsedPlan {
  const quotaPatch = (quotas || {}) as Partial<PlanQuotas>;
  const featurePatch = (features || {}) as Partial<PlanFeatures>;
  return {
    ...plan,
    quotas: {
      seats: numberOr(quotaPatch.seats, plan.quotas.seats),
      quotes_per_month: numberOr(quotaPatch.quotes_per_month, plan.quotas.quotes_per_month),
      ai_briefs_per_month: -1,
      concurrent_scrape_runs: Math.max(1, numberOr(quotaPatch.concurrent_scrape_runs, plan.quotas.concurrent_scrape_runs)),
      raw_data_retention_days: Math.max(1, numberOr(quotaPatch.raw_data_retention_days, plan.quotas.raw_data_retention_days)),
    },
    features: {
      ...plan.features,
      ...pickFeatures(featurePatch),
      custom_branding: true,
    },
  };
}

function numberOr(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickFeatures(patch: Partial<PlanFeatures>): Partial<PlanFeatures> {
  const keys: (keyof PlanFeatures)[] = [
    "sources", "scraping", "data_library", "leads", "lists",
    "companies", "contacts", "deals", "tasks", "quotes", "product_modules",
    "inbox", "calendar", "sequences", "team", "crm_integrations",
    "export_docx",
    "contracts",
    "byok_ai",
    "ai_agent",
    "lead_scrape",
    "mcp_access",
  ];
  const next: Partial<PlanFeatures> = {};
  for (const key of keys) {
    if (typeof patch[key] === "boolean") next[key] = patch[key];
  }
  return next;
}

function feature(features: Partial<PlanFeatures>, key: keyof PlanFeatures, fallback: boolean) {
  return typeof features[key] === "boolean" ? Boolean(features[key]) : fallback;
}
