export type ImportTarget = "company" | "contact";

export function importEligibility(record: {
  record_type: string;
  review_status: string;
  duplicate_of_id: string | null;
  quality_score: number;
}, target: ImportTarget) {
  if (record.review_status === "suppressed") return { eligible: false, reason: "suppressed" } as const;
  if (record.duplicate_of_id) return { eligible: false, reason: "duplicate_source_record" } as const;
  if (record.quality_score < 50) return { eligible: false, reason: "quality_below_50" } as const;
  const compatible = target === "company"
    ? ["organization", "place", "generic_record"].includes(record.record_type)
    : ["person_profile", "generic_record"].includes(record.record_type);
  return compatible
    ? { eligible: true, reason: "" } as const
    : { eligible: false, reason: "incompatible_record_type" } as const;
}

export function withoutEmptyValues<T extends Record<string, string>>(values: T) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())) as Partial<T>;
}
