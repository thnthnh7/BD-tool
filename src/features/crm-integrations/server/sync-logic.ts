export type SyncObject = "companies" | "contacts" | "deals";
export type ConflictPolicy = "latest_update" | "leadely_wins" | "crm_wins";
export type FieldMapping = { leadely_field: string; external_field: string; sync_direction: string; transformation: string; required: boolean };

const localFieldAliases: Record<SyncObject, Record<string, string>> = {
  companies: { employee_count: "company_size" },
  contacts: {},
  deals: { name: "title", value: "amount" },
};

const writableFields: Record<SyncObject, Set<string>> = {
  companies: new Set(["name", "domain", "website", "industry", "company_size", "phone", "email", "address", "notes"]),
  contacts: new Set(["first_name", "last_name", "display_name", "email", "phone", "job_title", "linkedin_url", "notes"]),
  deals: new Set(["title", "description", "amount", "currency", "probability", "expected_close_date", "priority", "source"]),
};

export function transformCrmValue(value: string | null | undefined, transformation: string) {
  if (value == null) return null;
  if (transformation === "trim") return value.trim();
  if (transformation === "lowercase") return value.toLowerCase();
  if (transformation === "uppercase") return value.toUpperCase();
  if (transformation === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (transformation === "date") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return value;
}

export function applyImportMappings<T extends Record<string, unknown>>(objectType: SyncObject, base: T, properties: Record<string, string | null>, mappings: FieldMapping[]): T {
  const output: Record<string, unknown> = { ...base };
  for (const mapping of mappings) {
    if (!["import", "bidirectional"].includes(mapping.sync_direction)) continue;
    const value = transformCrmValue(properties[mapping.external_field], mapping.transformation);
    if (mapping.required && (value == null || value === "")) throw new Error(`Required CRM field is missing: ${mapping.external_field}.`);
    if (value == null) continue;
    const localField = localFieldAliases[objectType][mapping.leadely_field] || mapping.leadely_field;
    if (!writableFields[objectType].has(localField)) {
      if (mapping.required) throw new Error(`CRM field cannot be imported into protected field: ${mapping.leadely_field}.`);
      continue;
    }
    output[localField] = value;
  }
  return output as T;
}

export function resolveImportConflict(policy: ConflictPolicy, lastSyncedAt: string | null, localUpdatedAt: string | null, externalUpdatedAt: string | null) {
  if (!lastSyncedAt || !localUpdatedAt || !externalUpdatedAt) return "import" as const;
  const watermark = new Date(lastSyncedAt).getTime();
  const localTime = new Date(localUpdatedAt).getTime();
  const externalTime = new Date(externalUpdatedAt).getTime();
  if (![watermark, localTime, externalTime].every(Number.isFinite)) return "import" as const;
  const localChanged = localTime > watermark;
  const externalChanged = externalTime > watermark;
  if (localChanged && !externalChanged) return "preserve_local" as const;
  if (!localChanged) return "import" as const;
  if (policy === "crm_wins") return "import" as const;
  if (policy === "leadely_wins") return "preserve_local" as const;
  return externalTime >= localTime ? "import" as const : "preserve_local" as const;
}
