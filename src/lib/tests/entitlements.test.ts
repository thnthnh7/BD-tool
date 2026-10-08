import assert from "node:assert/strict";
import test from "node:test";
import { applyEntitlementSnapshot, canUsePaidFeatures, createEntitlementSnapshot, isPlanLocked, parsePlan } from "@/lib/entitlements";

function row(features: Record<string, boolean> = {}, quotas: Record<string, number> = {}) {
  return {
    id: "plan",
    slot: 1,
    name: "Plan",
    slug: "plan",
    is_public: true,
    is_free: false,
    price_monthly: 0,
    price_yearly: 0,
    trial_days: 0,
    quotas,
    features,
    sort_order: 1,
    badge: "",
  };
}

test("missing module flags fail closed while the legacy scrape alias remains supported", () => {
  const plan = parsePlan(row({ lead_scrape: true }));
  assert.equal(plan.features.sources, false);
  assert.equal(plan.features.scraping, true);
  assert.equal(plan.features.deals, false);
  assert.equal(plan.features.ai_agent, false);
});

test("explicit module settings override compatibility defaults", () => {
  const plan = parsePlan(row({ scraping: false, deals: false, ai_agent: false, lead_scrape: true }));
  assert.equal(plan.features.scraping, false);
  assert.equal(plan.features.lead_scrape, false);
  assert.equal(plan.features.deals, false);
  assert.equal(plan.features.ai_agent, false);
});

test("custom branding is available on every plan and cannot be disabled by a legacy snapshot", () => {
  const plan = parsePlan(row({ custom_branding: false }));
  assert.equal(plan.features.custom_branding, true);

  const effective = applyEntitlementSnapshot(plan, {
    version: 1,
    quotas: {},
    features: { custom_branding: false },
  });
  assert.equal(effective.features.custom_branding, true);
});

test("pending and suspended subscriptions never receive paid access", () => {
  for (const status of ["pending", "suspended", "expired", "canceled"] as const) {
    assert.equal(isPlanLocked(status), true);
    assert.equal(canUsePaidFeatures(status), false);
  }
  for (const status of ["trialing", "active", "past_due"] as const) {
    assert.equal(isPlanLocked(status), false);
    assert.equal(canUsePaidFeatures(status), true);
  }
});

test("subscription snapshots preserve entitlements after the plan changes", () => {
  const original = parsePlan(row({ deals: true, contracts: false }, { seats: 2 }));
  const snapshot = createEntitlementSnapshot(original, 3);
  const changedPlan = parsePlan(row({ deals: false, contracts: true }, { seats: 10 }));
  const effective = applyEntitlementSnapshot(changedPlan, snapshot);
  assert.equal(effective.features.deals, true);
  assert.equal(effective.features.contracts, false);
  assert.equal(effective.quotas.seats, 2);
});

test("legacy AI quotas are always interpreted as unlimited while capacity defaults stay safe", () => {
  const plan = parsePlan(row({}, { ai_briefs_per_month: 3 }));
  assert.equal(plan.quotas.ai_briefs_per_month, -1);
  const effective = applyEntitlementSnapshot(plan, {
    version: 1,
    quotas: { ai_briefs_per_month: 1 },
    features: {},
  });
  assert.equal(effective.quotas.ai_briefs_per_month, -1);
  assert.equal(effective.quotas.concurrent_scrape_runs, 1);
  assert.equal(effective.quotas.raw_data_retention_days, 7);
});
