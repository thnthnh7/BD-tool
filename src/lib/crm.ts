export const LIFECYCLE_STAGES = ["prospect", "active_opportunity", "customer", "partner", "inactive"] as const;
export const RELATIONSHIP_STRENGTHS = ["unknown", "weak", "developing", "strong"] as const;
export const LEAD_STATUSES = ["new", "working", "connected", "qualified", "unqualified"] as const;
export const DEAL_TYPES = ["sales", "partnership", "referral", "strategic", "sponsorship", "other"] as const;
export const DEAL_PRIORITIES = ["low", "medium", "high"] as const;
export const STAKEHOLDER_ROLES = [
  "decision_maker",
  "champion",
  "economic_buyer",
  "technical_evaluator",
  "procurement",
  "influencer",
  "end_user",
  "partner",
  "other",
] as const;
export const TASK_TYPES = ["follow_up", "call", "email", "meeting", "proposal", "review", "other"] as const;
export const TASK_STATUSES = ["open", "completed", "canceled"] as const;

export function contactDisplayName(firstName: string, lastName: string, fallback = "") {
  const name = `${firstName} ${lastName}`.trim();
  return name || fallback;
}

export function formText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export function formOptionalId(formData: FormData, key: string) {
  const value = formText(formData, key);
  return value || null;
}

export function formInt(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(formData.get(key));
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function asJoined<T>(value: unknown): T {
  return value as T;
}
