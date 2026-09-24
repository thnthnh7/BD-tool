export type PlanQuotas = {
  seats: number;
  quotes_per_month: number;
  ai_briefs_per_month: number;
  maps_scrapes_per_month: number;
  maps_places_per_month: number;
  maps_people_per_month: number;
};

export type PlanFeatures = {
  export_docx: boolean;
  custom_branding: boolean;
  contracts: boolean;
  byok_ai: boolean;
  lead_scrape: boolean;
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
      ai_briefs_per_month: Number(quotas.ai_briefs_per_month ?? 0),
      maps_scrapes_per_month: Number(quotas.maps_scrapes_per_month ?? 0),
      maps_places_per_month: Number(quotas.maps_places_per_month ?? 0),
      maps_people_per_month: Number(quotas.maps_people_per_month ?? 0),
    },
    features: {
      export_docx: Boolean(features.export_docx),
      custom_branding: Boolean(features.custom_branding),
      contracts: Boolean(features.contracts),
      byok_ai: Boolean(features.byok_ai),
      lead_scrape: Boolean(features.lead_scrape),
    },
    sortOrder: row.sort_order,
    badge: row.badge,
  };
}

export type PlanStatus = "trialing" | "active" | "past_due" | "expired" | "canceled";

export function isPlanLocked(status: PlanStatus) {
  return status === "expired" || status === "canceled";
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
      ai_briefs_per_month: numberOr(quotaPatch.ai_briefs_per_month, plan.quotas.ai_briefs_per_month),
      maps_scrapes_per_month: numberOr(quotaPatch.maps_scrapes_per_month, plan.quotas.maps_scrapes_per_month),
      maps_places_per_month: numberOr(quotaPatch.maps_places_per_month, plan.quotas.maps_places_per_month),
      maps_people_per_month: numberOr(quotaPatch.maps_people_per_month, plan.quotas.maps_people_per_month),
    },
    features: {
      ...plan.features,
      ...pickFeatures(featurePatch),
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
    "export_docx",
    "custom_branding",
    "contracts",
    "byok_ai",
    "lead_scrape",
  ];
  const next: Partial<PlanFeatures> = {};
  for (const key of keys) {
    if (typeof patch[key] === "boolean") next[key] = patch[key];
  }
  return next;
}
