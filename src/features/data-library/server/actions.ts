"use server";

import { requireModule } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/lib/database.types";
import { withWorkspace } from "@/lib/events";
import { importEligibility, withoutEmptyValues, type ImportTarget } from "@/features/data-library/import-policy";

function object(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function listDataLibrary(input: { q?: string; type?: string; collectionId?: string; status?: string; minQuality?: number; page?: number }) {
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
  if (input.status) query = query.eq("review_status", input.status);
  if (input.minQuality) query = query.gte("quality_score", input.minQuality);
  if (input.q?.trim()) query = query.or(`title.ilike.%${input.q.trim().replaceAll(",", "") }%,canonical_url.ilike.%${input.q.trim().replaceAll(",", "")}%`);
  const { data: records, count } = await query.range(from, to);

  const { data: counts, error: countsError } = await supabase.rpc("data_library_type_counts");
  if (countsError) console.error("data_library_type_counts failed", countsError.message);
  const typeCounts = (counts || []).map((item) => [item.record_type, Number(item.record_count)] as const);
  return { collections: collections || [], records: records || [], total: count || 0, page, pageSize, typeCounts };
}

export async function promoteDataRecordAction(formData: FormData) {
  await requireModule("data_library"); // promoteDataRecordAction
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
  if (row.review_status === "suppressed") return { error: "This record is suppressed and cannot be imported." };
  if (row.duplicate_of_id) return { error: "This is a duplicate. Review the original record before importing." };
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
    await supabase.from("data_records").update({ promoted_company_id: company.id, review_status: "imported" }).eq("id", row.id).eq("workspace_id", context.workspaceId);
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
    await supabase.from("data_records").update({ promoted_contact_id: contact.id, review_status: "imported" }).eq("id", row.id).eq("workspace_id", context.workspaceId);
  } else {
    return { error: "Unsupported target." };
  }
  revalidatePath("/app/data");
  revalidatePath("/app/companies");
  revalidatePath("/app/contacts");
  return { ok: true as const };
}

export async function setDataRecordSuppressionAction(formData: FormData) {
  await requireModule("data_library");
  const { context, supabase } = await withWorkspace();
  if (context.memberRole === "member") return { error: "Only workspace owners and admins can change suppressions." };
  const recordId = String(formData.get("record_id") || "");
  const suppressed = String(formData.get("suppressed") || "") === "true";
  if (!recordId) return { error: "Record not found." };
  const { error } = await supabase.rpc("set_data_record_suppression", {
    p_record_id: recordId,
    p_suppressed: suppressed,
    p_reason: String(formData.get("reason") || "manual").slice(0, 200),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/data");
  return { ok: true as const };
}

export async function importDataRecordsAction(formData: FormData) {
  await requireModule("data_library");
  const { context, supabase } = await withWorkspace();
  const target = String(formData.get("target") || "");
  const duplicatePolicy = String(formData.get("duplicate_policy") || "skip");
  if (!(["company", "contact"] as string[]).includes(target)) return { error: "Unsupported CRM target." };
  if (!(["skip", "update"] as string[]).includes(duplicatePolicy)) return { error: "Unsupported duplicate policy." };
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("record_ids") || "[]"));
    if (Array.isArray(parsed)) ids = [...new Set(parsed.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 100);
  } catch { return { error: "Invalid record selection." }; }
  if (!ids.length) return { error: "Select at least one record." };

  const { data: batch, error: batchError } = await supabase.from("data_import_batches").insert({
    workspace_id: context.workspaceId, created_by: context.userId, target_type: target,
    duplicate_policy: duplicatePolicy, total_count: ids.length, status: "processing",
  }).select("id").single();
  if (batchError || !batch) return { error: batchError?.message || "Could not start the import." };
  const batchId = batch.id;

  async function failBatch(message: string) {
    await supabase.from("data_import_batches").update({
      status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString(),
    }).eq("id", batchId).eq("workspace_id", context.workspaceId);
  }

  const { data: records, error: recordsError } = await supabase.from("data_records").select("*")
    .eq("workspace_id", context.workspaceId).in("id", ids);
  if (recordsError) {
    await failBatch(recordsError.message);
    return { error: recordsError.message };
  }
  const counts = { imported: 0, updated: 0, skipped: ids.length - (records?.length || 0), failed: 0 };
  const items: Database["public"]["Tables"]["data_import_items"]["Insert"][] = [];

  for (const row of records || []) {
    const item = { workspace_id: context.workspaceId, batch_id: batchId, record_id: row.id, status: "skipped", reason: "" } as Database["public"]["Tables"]["data_import_items"]["Insert"];
    try {
      const eligibility = importEligibility(row, target as ImportTarget);
      if (!eligibility.eligible) { item.reason = eligibility.reason; counts.skipped += 1; items.push(item); continue; }
      const normalized = object(row.normalized_data);
      const raw = object(row.raw_data);
      const title = row.title || string(normalized.title) || "Untitled";
      const url = row.canonical_url || string(normalized.url);
      const email = (string(normalized.email) || string(raw.email)).toLowerCase();
      const phone = string(normalized.phone) || string(raw.phone);

      if (target === "company") {
        let domain = string(normalized.domain);
        if (!domain && url) { try { domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { domain = ""; } }
        const existing = domain ? (await supabase.from("companies").select("id").eq("workspace_id", context.workspaceId).eq("domain", domain).maybeSingle()).data : null;
        if (existing && duplicatePolicy === "skip") { item.reason = "company_exists"; item.company_id = existing.id; counts.skipped += 1; items.push(item); continue; }
        if (existing) {
          const { error } = await supabase.from("companies").update(withoutEmptyValues({ name: title, website: url, email, phone, industry: string(raw.industry) || string(raw.category), address: string(raw.address) })).eq("id", existing.id).eq("workspace_id", context.workspaceId);
          if (error) throw error;
          item.status = "updated"; item.company_id = existing.id;
        } else {
          const { data: company, error } = await supabase.from("companies").insert({ workspace_id: context.workspaceId, name: title, domain, website: url, email, phone, industry: string(raw.industry) || string(raw.category), address: string(raw.address), owner_user_id: context.userId, lifecycle_stage: "prospect", lead_source: "data_library", notes: `Source record: ${row.id}` }).select("id").single();
          if (error || !company) throw error || new Error("Could not create company.");
          item.status = "imported"; item.company_id = company.id;
        }
        const { error: recordError } = await supabase.from("data_records").update({ promoted_company_id: item.company_id, review_status: "imported" }).eq("id", row.id).eq("workspace_id", context.workspaceId);
        if (recordError) throw recordError;
      } else {
        const existing = email ? (await supabase.from("contacts").select("id").eq("workspace_id", context.workspaceId).ilike("email", email).maybeSingle()).data : null;
        const parts = title.trim().split(/\s+/);
        if (existing && duplicatePolicy === "skip") { item.reason = "contact_exists"; item.contact_id = existing.id; counts.skipped += 1; items.push(item); continue; }
        if (existing) {
          const { error } = await supabase.from("contacts").update(withoutEmptyValues({ first_name: parts[0] || "", last_name: parts.slice(1).join(" "), display_name: title, email, phone, linkedin_url: url.includes("linkedin.com") ? url : "" })).eq("id", existing.id).eq("workspace_id", context.workspaceId);
          if (error) throw error;
          item.status = "updated"; item.contact_id = existing.id;
        } else {
          const { data: contact, error } = await supabase.from("contacts").insert({ workspace_id: context.workspaceId, first_name: parts[0] || "", last_name: parts.slice(1).join(" "), display_name: title, email, phone, linkedin_url: url.includes("linkedin.com") ? url : "", owner_user_id: context.userId, notes: `${url ? `Profile: ${url}\n` : ""}Source record: ${row.id}` }).select("id").single();
          if (error || !contact) throw error || new Error("Could not create contact.");
          item.status = "imported"; item.contact_id = contact.id;
        }
        const { error: recordError } = await supabase.from("data_records").update({ promoted_contact_id: item.contact_id, review_status: "imported" }).eq("id", row.id).eq("workspace_id", context.workspaceId);
        if (recordError) throw recordError;
      }
      if (item.status === "updated") counts.updated += 1;
      else counts.imported += 1;
    } catch (error) {
      item.status = "failed";
      item.reason = error instanceof Error ? error.message.slice(0, 300) : "Import failed";
      counts.failed += 1;
    }
    items.push(item);
  }

  if (items.length) {
    const { error } = await supabase.from("data_import_items").insert(items);
    if (error) {
      await failBatch(error.message);
      return { error: error.message };
    }
  }
  const { error: completeError } = await supabase.from("data_import_batches").update({
    status: "completed", imported_count: counts.imported, updated_count: counts.updated,
    skipped_count: counts.skipped, failed_count: counts.failed, finished_at: new Date().toISOString(),
  }).eq("id", batchId).eq("workspace_id", context.workspaceId);
  if (completeError) {
    await failBatch(completeError.message);
    return { error: completeError.message };
  }
  revalidatePath("/app/data");
  revalidatePath("/app/companies");
  revalidatePath("/app/contacts");
  return { ok: true as const, batchId, counts };
}
