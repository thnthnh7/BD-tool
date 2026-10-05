"use server";

import { requireModule } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { asJoined, formOptionalId, formText } from "@/lib/crm";
import { withWorkspace } from "@/lib/events";
import type { Database } from "@/lib/database.types";

export async function listLeadLists() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("lead_lists")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });
  return data || [];
}

export async function getLeadList(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data: list } = await supabase
    .from("lead_lists")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (!list) return null;
  const { data: members } = await supabase
    .from("lead_list_members")
    .select("*, companies(name, logo_path, industry, phone, website, address), contacts(display_name, job_title, email, phone, linkedin_url), leads(status, source)")
    .eq("list_id", id)
    .order("created_at", { ascending: false });
  return {
    list,
    members: asJoined<
      Array<
        Database["public"]["Tables"]["lead_list_members"]["Row"] & {
          companies: { name?: string; logo_path?: string; industry?: string; phone?: string; website?: string; address?: string } | null;
          contacts: {
            display_name?: string;
            job_title?: string;
            email?: string;
            phone?: string;
            linkedin_url?: string;
          } | null;
          leads: { status?: string; source?: string } | null;
        }
      >
    >(members || []),
  };
}

export async function createLeadListAction(formData: FormData) {
  await requireModule("lists"); // createLeadListAction
  const { context, supabase } = await withWorkspace();
  const name = formText(formData, "name");
  if (!name) return { error: "Cần tên list." };
  const { data, error } = await supabase
    .from("lead_lists")
    .insert({
      workspace_id: context.workspaceId,
      name,
      description: formText(formData, "description") || null,
      source: "manual",
      owner_user_id: context.userId,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được list." };
  revalidatePath("/app/lists");
  return { ok: true as const, id: data.id };
}

export async function addListMemberAction(formData: FormData) {
  await requireModule("lists"); // addListMemberAction
  const { context, supabase } = await withWorkspace();
  const listId = formText(formData, "list_id");
  const companyId = formText(formData, "company_id");
  if (!listId || !companyId) return { error: "Cần list và company." };
  const { error } = await supabase.from("lead_list_members").upsert(
    {
      workspace_id: context.workspaceId,
      list_id: listId,
      company_id: companyId,
      lead_id: formOptionalId(formData, "lead_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      added_from: "crm",
    },
    { onConflict: "list_id,company_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/app/lists/${listId}`);
  return { ok: true as const };
}

export async function updateListMemberStatusAction(formData: FormData) {
  await requireModule("lists"); // updateListMemberStatusAction
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const { error } = await supabase
    .from("lead_list_members")
    .update({ status: formText(formData, "status") || "new" })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/lists");
  return { ok: true as const };
}

export async function loadListExportRows(listId: string) {
  const payload = await getLeadList(listId);
  if (!payload) return [];
  return payload.members.map((member) => {
    const company = member.companies as { name?: string; industry?: string; phone?: string; website?: string; address?: string } | null;
    const contact = member.contacts as {
      display_name?: string;
      job_title?: string;
      email?: string;
      phone?: string;
      linkedin_url?: string;
    } | null;
    return {
      name: company?.name || "",
      industry: company?.industry || "",
      phone: company?.phone || "",
      website: company?.website || "",
      address: company?.address || "",
      rating: "",
      maps_url: "",
      contact_name: contact?.display_name || "",
      job_title: contact?.job_title || "",
      contact_email: contact?.email || "",
      contact_phone: contact?.phone || "",
      linkedin_url: contact?.linkedin_url || "",
      owner: "",
      list_status: member.status,
    };
  });
}
