"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import { withWorkspace } from "@/lib/events";

function object(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function listDataLibrary(input: { q?: string; type?: string; collectionId?: string; page?: number }) {
  const { context, supabase } = await withWorkspace();
  const page = Math.max(1, input.page || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: collections } = await supabase
    .from("data_collections")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });

  let query = supabase
    .from("data_records")
    .select("*", { count: "exact" })
    .eq("workspace_id", context.workspaceId)
    .order("captured_at", { ascending: false });
  if (input.collectionId) query = query.eq("collection_id", input.collectionId);
  if (input.type) query = query.eq("record_type", input.type);
  if (input.q?.trim()) query = query.or(`title.ilike.%${input.q.trim().replaceAll(",", "") }%,canonical_url.ilike.%${input.q.trim().replaceAll(",", "")}%`);
  const { data: records, count } = await query.range(from, to);

  const { data: counts, error: countsError } = await supabase.rpc("data_library_type_counts");
  if (countsError) console.error("data_library_type_counts failed", countsError.message);
  const typeCounts = (counts || []).map((item) => [item.record_type, Number(item.record_count)] as const);
  return { collections: collections || [], records: records || [], total: count || 0, page, pageSize, typeCounts };
}

export async function promoteDataRecordAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const recordId = String(formData.get("record_id") || "");
  const target = String(formData.get("target") || "");
  const { data: row, error } = await supabase
    .from("data_records")
    .select("*")
    .eq("id", recordId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (error || !row) return { error: error?.message || "Record not found." };
  const normalized = object(row.normalized_data);
  const raw = object(row.raw_data);
  const title = row.title || string(normalized.title) || "Untitled";
  const url = row.canonical_url || string(normalized.url);
  const email = string(normalized.email) || string(raw.email);
  const phone = string(normalized.phone) || string(raw.phone);
  const companyTypes = new Set(["organization", "place", "generic_record"]);
  const contactTypes = new Set(["person_profile", "generic_record"]);

  if (target === "company") {
    if (!companyTypes.has(row.record_type)) return { error: "This record type cannot be promoted to a company." };
    let domain = "";
    try { domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { domain = ""; }
    const existing = row.promoted_company_id
      ? { id: row.promoted_company_id }
      : domain
        ? (await supabase.from("companies").select("id").eq("workspace_id", context.workspaceId).eq("domain", domain).maybeSingle()).data
        : null;
    const company = existing || (await supabase.from("companies").insert({
      workspace_id: context.workspaceId,
      name: title,
      domain,
      website: url,
      email,
      phone,
      industry: string(raw.industry) || string(raw.category),
      address: string(raw.address),
      owner_user_id: context.userId,
      lifecycle_stage: "prospect",
      lead_source: "data_library",
      notes: `Source record: ${row.id}`,
    }).select("id").single()).data;
    if (!company) return { error: "Could not create company." };
    await supabase.from("data_records").update({ promoted_company_id: company.id }).eq("id", row.id);
  } else if (target === "contact") {
    if (!contactTypes.has(row.record_type)) return { error: "This record type cannot be promoted to a contact." };
    const fullName = title.trim();
    const parts = fullName.split(/\s+/);
    const existing = row.promoted_contact_id
      ? { id: row.promoted_contact_id }
      : email
        ? (await supabase.from("contacts").select("id").eq("workspace_id", context.workspaceId).eq("email", email).maybeSingle()).data
        : null;
    const contact = existing || (await supabase.from("contacts").insert({
      workspace_id: context.workspaceId,
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" "),
      display_name: fullName,
      email,
      phone,
      linkedin_url: url.includes("linkedin.com") ? url : "",
      owner_user_id: context.userId,
      notes: `${url ? `Profile: ${url}\n` : ""}Source record: ${row.id}`,
    }).select("id").single()).data;
    if (!contact) return { error: "Could not create contact." };
    await supabase.from("data_records").update({ promoted_contact_id: contact.id }).eq("id", row.id);
  } else {
    return { error: "Unsupported target." };
  }
  revalidatePath("/app/data");
  revalidatePath("/app/companies");
  revalidatePath("/app/contacts");
  return { ok: true as const };
}
