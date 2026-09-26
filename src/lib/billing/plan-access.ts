import type { PlanStatus } from "@/lib/entitlements";

const PLAN_STATUSES = new Set<PlanStatus>(["trialing", "active", "past_due", "expired", "canceled"]);

export function effectivePlanStatus(status: PlanStatus, deactivatedAt?: string | null): PlanStatus {
  return deactivatedAt ? "canceled" : status;
}

export function restoredPlanStatus(subscriptionStatus?: string | null, previousStatus?: string | null): PlanStatus {
  if (subscriptionStatus && PLAN_STATUSES.has(subscriptionStatus as PlanStatus)) return subscriptionStatus as PlanStatus;
  if (previousStatus && PLAN_STATUSES.has(previousStatus as PlanStatus)) return previousStatus as PlanStatus;
  return "expired";
}
