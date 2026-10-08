const activeStatuses = new Set(["active", "ACTIVE"]);
const pastDueStatuses = new Set(["past_due", "PAYMENT_FAILED"]);
const suspendedStatuses = new Set(["unpaid", "paused", "SUSPENDED"]);

export const canceledProviderStatuses = new Set(["canceled", "cancelled", "CANCELLED"]);

export function providerAccessStatus(providerStatus: string, currentPeriodEnd?: string) {
  if (providerStatus === "trialing") return "trialing";
  if (activeStatuses.has(providerStatus)) return "active";
  if (pastDueStatuses.has(providerStatus)) return "past_due";
  if (suspendedStatuses.has(providerStatus)) return "suspended";
  if (canceledProviderStatuses.has(providerStatus)) {
    return currentPeriodEnd && new Date(currentPeriodEnd).getTime() > Date.now() ? "active" : "canceled";
  }
  if (providerStatus === "EXPIRED" || providerStatus === "incomplete_expired") return "expired";
  return "pending";
}
