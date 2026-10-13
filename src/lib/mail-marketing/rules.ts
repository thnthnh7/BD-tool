export type LifecycleTrigger = "beta_welcome" | "beta_no_source" | "beta_no_scrape" | "beta_first_value" | "beta_inactive" | "beta_expiry_14" | "beta_expiry_2";

export type LifecycleFacts = {
  grantedAt: number;
  accessEndsAt: number;
  lastSeenAt: number | null;
  sourceInstalledAt: number | null;
  firstScrapeAt: number | null;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function triggerEligible(trigger: LifecycleTrigger, delayHours: number, facts: LifecycleFacts, now = Date.now()) {
  const age = now - facts.grantedAt;
  const daysLeft = Math.ceil((facts.accessEndsAt - now) / DAY);
  if (facts.accessEndsAt <= now || age < delayHours * HOUR) return false;
  if (trigger === "beta_welcome") return true;
  if (trigger === "beta_no_source") return !facts.sourceInstalledAt;
  if (trigger === "beta_no_scrape") return Boolean(facts.sourceInstalledAt && !facts.firstScrapeAt);
  if (trigger === "beta_first_value") return Boolean(facts.firstScrapeAt);
  if (trigger === "beta_inactive") return now - (facts.lastSeenAt || facts.grantedAt) >= 7 * DAY;
  if (trigger === "beta_expiry_14") return daysLeft > 7 && daysLeft <= 14;
  return daysLeft > 0 && daysLeft <= 2;
}

export function categoryAllowed(category: string, preferences: { product_tips: boolean; beta_updates: boolean; announcements: boolean; unsubscribed_all: boolean }) {
  if (preferences.unsubscribed_all) return false;
  if (category === "service") return true;
  if (category === "product_tips") return preferences.product_tips;
  if (category === "beta_updates") return preferences.beta_updates;
  if (category === "announcements") return preferences.announcements;
  return false;
}

export function renderTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => String(variables[key] ?? ""));
}
