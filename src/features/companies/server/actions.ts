"use server";

import { requireModule } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { recordActivity, withWorkspace } from "@/lib/events";
import { uploadLogoJpeg } from "@/lib/logo-storage";
import { asJoined, contactDisplayName, formOptionalId, formText, LIFECYCLE_STAGES } from "@/lib/crm";
import type { Database } from "@/lib/database.types";

export async function listCompanies() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });
  return data || [];
}

export async function listCompaniesPage(options: { query?: string; page?: number; pageSize?: number } = {}) {
  const { context, supabase } = await withWorkspace();
  const pageSize = options.pageSize ?? 20;
  const requested = Math.max(1, options.page || 1);
  const queryText = (options.query || "").trim();

  const load = async (page: number) => {
    const from = (page - 1) * pageSize;
    let request = supabase
      .from("companies")
      .select("*", { count: "exact" })
      .eq("workspace_id", context.workspaceId)
      .order("updated_at", { ascending: false });
    if (queryText) {
      const pattern = quote(`%${queryText.replace(/[%_]/g, "")}%`);
      const clauses = ["name", "website", "domain", "email", "phone"].map((column) => `${column}.ilike.${pattern}`);
      request = request.or(clauses.join(","));
    }
    const { data, count } = await request.range(from, from + pageSize - 1);
    return { rows: data || [], total: count || 0 };
  };

  const first = await load(requested);
  const pageCount = Math.max(1, Math.ceil(first.total / pageSize));
  const page = Math.min(requested, pageCount);
  const result = page === requested ? first : await load(page);
  return { rows: result.rows, total: first.total, page, pageSize };
}

export async function getCompany(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function logoFromForm(supabase: Awaited<ReturnType<typeof withWorkspace>>["supabase"], workspaceId: string, companyId: string, formData: FormData) {
  const logoData = formText(formData, "logo_data");
  const clearLogo = formText(formData, "logo_clear") === "1";
  if (!logoData && !clearLogo) return {};
  if (!logoData) return { logo_path: "" };
  const stored = await uploadLogoJpeg(supabase, `${workspaceId}/companies/${companyId}.jpg`, logoData);
  if ("error" in stored) return { error: stored.error };
  return { logo_path: stored.url };
}

async function syncLegacyClientLogo(supabase: Awaited<ReturnType<typeof withWorkspace>>["supabase"], workspaceId: string, companyId: string, logoUrl: string) {
  const { data } = await supabase.from("companies").select("legacy_client_id").eq("id", companyId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data?.legacy_client_id) return;
  await supabase.from("clients").update({ logo_url: logoUrl }).eq("id", data.legacy_client_id).eq("workspace_id", workspaceId);
}

function revalidateCompanySurfaces(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/companies");
  revalidatePath("/app/deals");
  revalidatePath("/app/leads");
  revalidatePath("/app/contacts");
  revalidatePath("/app/quotes");
  if (id) revalidatePath(`/app/companies/${id}`);
}

export async function createCompanyAction(formData: FormData) {
  await requireModule("companies"); // createCompanyAction
  const { context, supabase } = await withWorkspace();
  const name = formText(formData, "name");
  if (!name) return { error: "Tên công ty bắt buộc." };
  const lifecycle = formText(formData, "lifecycle_stage") || "prospect";
  const id = crypto.randomUUID();
  const logo = await logoFromForm(supabase, context.workspaceId, id, formData);
  if (logo.error) return { error: logo.error };
  const { data, error } = await supabase
    .from("companies")
    .insert({
      id,
      workspace_id: context.workspaceId,
      logo_path: logo.logo_path || "",
      name,
      domain: formText(formData, "domain"),
      website: formText(formData, "website"),
      industry: formText(formData, "industry"),
      company_size: formText(formData, "company_size"),
      phone: formText(formData, "phone"),
      email: formText(formData, "email"),
      address: formText(formData, "address"),
      tax_code: formText(formData, "tax_code"),
      owner_user_id: context.userId,
      lifecycle_stage: LIFECYCLE_STAGES.includes(lifecycle as (typeof LIFECYCLE_STAGES)[number]) ? lifecycle : "prospect",
      lead_source: formText(formData, "lead_source"),
      notes: formText(formData, "notes"),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được công ty." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: data.id,
    activityType: "note",
    title: `Created company ${name}`,
    isSystem: true,
  });
  revalidateCompanySurfaces(data.id);
  return { ok: true as const, id: data.id };
}

export async function updateCompanyAction(formData: FormData) {
  await requireModule("companies"); // updateCompanyAction
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const name = formText(formData, "name");
  if (!id || !name) return { error: "Thiếu thông tin công ty." };
  const logo = await logoFromForm(supabase, context.workspaceId, id, formData);
  if (logo.error) return { error: logo.error };
  const { error } = await supabase
    .from("companies")
    .update({
      ...(logo.logo_path !== undefined ? { logo_path: logo.logo_path } : {}),
      name,
      domain: formText(formData, "domain"),
      website: formText(formData, "website"),
      industry: formText(formData, "industry"),
      company_size: formText(formData, "company_size"),
      phone: formText(formData, "phone"),
      email: formText(formData, "email"),
      address: formText(formData, "address"),
      tax_code: formText(formData, "tax_code"),
      lifecycle_stage: formText(formData, "lifecycle_stage") || "prospect",
      lead_source: formText(formData, "lead_source"),
      notes: formText(formData, "notes"),
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  if (logo.logo_path !== undefined) await syncLegacyClientLogo(supabase, context.workspaceId, id, logo.logo_path);
  revalidateCompanySurfaces(id);
  return { ok: true as const };
}

export async function listCompanyContacts(companyId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("company_id", companyId)
    .order("display_name");
  return data || [];
}

export async function listCompanyDeals(companyId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("deals")
    .select("*, pipeline_stages(name, stage_type)")
    .eq("workspace_id", context.workspaceId)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });
  return asJoined<Array<Database["public"]["Tables"]["deals"]["Row"] & { pipeline_stages: { name: string; stage_type: string } | null }>>(data || []);
}

type ContactListRow = Database["public"]["Tables"]["contacts"]["Row"] & { companies: { name: string; logo_path: string } | null };

export async function listContacts() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("contacts")
    .select("*, companies(name, logo_path)")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });
  return asJoined<ContactListRow[]>(data || []);
}

export async function listContactsPage(options: { query?: string; page?: number; pageSize?: number } = {}) {
  const { context, supabase } = await withWorkspace();
  const pageSize = options.pageSize ?? 20;
  const requested = Math.max(1, options.page || 1);
  const queryText = (options.query || "").trim();

  let companyIds: string[] = [];
  if (queryText) {
    const { data: matched } = await supabase
      .from("companies")
      .select("id")
      .eq("workspace_id", context.workspaceId)
      .ilike("name", `%${queryText}%`);
    companyIds = (matched || []).map((row) => row.id);
  }

  const load = async (page: number) => {
    const from = (page - 1) * pageSize;
    let request = supabase
      .from("contacts")
      .select("*, companies(name, logo_path)", { count: "exact" })
      .eq("workspace_id", context.workspaceId)
      .order("updated_at", { ascending: false });
    if (queryText) {
      const pattern = quote(`%${queryText.replace(/[%_]/g, "")}%`);
      const clauses = ["display_name", "first_name", "last_name", "email", "phone"].map((column) => `${column}.ilike.${pattern}`);
      if (companyIds.length) clauses.push(`company_id.in.(${companyIds.join(",")})`);
      request = request.or(clauses.join(","));
    }
    const { data, count } = await request.range(from, from + pageSize - 1);
    return { rows: asJoined<ContactListRow[]>(data || []), total: count || 0 };
  };

  const first = await load(requested);
  const pageCount = Math.max(1, Math.ceil(first.total / pageSize));
  const page = Math.min(requested, pageCount);
  const result = page === requested ? first : await load(page);
  return { rows: result.rows, total: first.total, page, pageSize };
}

function quote(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

export async function getContact(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("contacts")
    .select("*, companies(name, logo_path)")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  return asJoined<(Database["public"]["Tables"]["contacts"]["Row"] & { companies: { name: string; logo_path: string } | null }) | null>(data);
}

export async function createContactAction(formData: FormData) {
  await requireModule("contacts"); // createContactAction
  const { context, supabase } = await withWorkspace();
  const firstName = formText(formData, "first_name");
  const lastName = formText(formData, "last_name");
  const displayName = formText(formData, "display_name") || contactDisplayName(firstName, lastName, formText(formData, "email"));
  if (!displayName) return { error: "Tên liên hệ bắt buộc." };
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      workspace_id: context.workspaceId,
      company_id: formOptionalId(formData, "company_id"),
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      email: formText(formData, "email"),
      phone: formText(formData, "phone"),
      job_title: formText(formData, "job_title"),
      linkedin_url: formText(formData, "linkedin_url"),
      owner_user_id: context.userId,
      relationship_strength: formText(formData, "relationship_strength") || "unknown",
      notes: formText(formData, "notes"),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được liên hệ." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: formOptionalId(formData, "company_id"),
    contactId: data.id,
    activityType: "note",
    title: `Created contact ${displayName}`,
  });
  revalidatePath("/app/contacts");
  return { ok: true as const, id: data.id };
}

export async function updateContactAction(formData: FormData) {
  await requireModule("contacts"); // updateContactAction
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const firstName = formText(formData, "first_name");
  const lastName = formText(formData, "last_name");
  const displayName = formText(formData, "display_name") || contactDisplayName(firstName, lastName, formText(formData, "email"));
  if (!id || !displayName) return { error: "Thiếu thông tin liên hệ." };
  const { error } = await supabase
    .from("contacts")
    .update({
      company_id: formOptionalId(formData, "company_id"),
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      email: formText(formData, "email"),
      phone: formText(formData, "phone"),
      job_title: formText(formData, "job_title"),
      linkedin_url: formText(formData, "linkedin_url"),
      relationship_strength: formText(formData, "relationship_strength") || "unknown",
      notes: formText(formData, "notes"),
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/contacts");
  revalidatePath(`/app/contacts/${id}`);
  return { ok: true as const };
}

export async function ensureLegacyClientForCompany(companyId: string) {
  const { context, supabase } = await withWorkspace();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!company) return null;
  if (company.legacy_client_id) {
    const { data: existing } = await supabase.from("clients").select("*").eq("id", company.legacy_client_id).maybeSingle();
    if (existing) {
      if ((existing.logo_url || "") !== (company.logo_path || "")) {
        await supabase.from("clients").update({ logo_url: company.logo_path || "" }).eq("id", existing.id).eq("workspace_id", context.workspaceId);
        return { ...existing, logo_url: company.logo_path || "" };
      }
      return existing;
    }
  }
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: context.workspaceId,
      company_name: company.name,
      contact_name: contact?.display_name || "",
      email: contact?.email || company.email,
      phone: contact?.phone || company.phone,
      tax_code: company.tax_code,
      address: company.address,
      industry: company.industry,
      notes: company.notes,
      logo_url: company.logo_path || "",
    })
    .select("*")
    .single();
  if (error || !client) return null;
  await supabase.from("companies").update({ legacy_client_id: client.id }).eq("id", company.id);
  return client;
}
