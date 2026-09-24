"use server";

import { revalidatePath } from "next/cache";
import { recordActivity, withWorkspace } from "@/lib/events";
import { asJoined, formInt, formOptionalId, formText, LEAD_STATUSES } from "@/lib/crm";
import type { Database } from "@/lib/database.types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type LeadListItem = LeadRow & {
  companies: { name: string; logo_path: string } | null;
  contacts: { display_name: string; email: string } | null;
};

export async function listLeads() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("leads")
    .select("*, companies(name, logo_path), contacts(display_name, email)")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });
  return asJoined<LeadListItem[]>(data || []);
}

export async function getLead(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("leads")
    .select("*, companies(name, logo_path), contacts(display_name, email, phone)")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  return asJoined<
    | (LeadRow & {
        companies: { name: string; logo_path: string } | null;
        contacts: { display_name: string; email: string; phone: string } | null;
      })
    | null
  >(data);
}

export async function createLeadAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const status = formText(formData, "status") || "new";
  const { data, error } = await supabase
    .from("leads")
    .insert({
      workspace_id: context.workspaceId,
      company_id: formOptionalId(formData, "company_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      owner_user_id: context.userId,
      status: LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number]) ? status : "new",
      source: formText(formData, "source") || "manual",
      score: formData.get("score") ? formInt(formData, "score") : null,
      score_reason: formText(formData, "score_reason") || null,
      next_action_at: formText(formData, "next_action_at") || null,
    })
    .select("id, company_id, contact_id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được lead." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: data.company_id,
    contactId: data.contact_id,
    leadId: data.id,
    activityType: "lead_created",
    title: "Lead created",
  });
  revalidatePath("/app/leads");
  return { ok: true as const, id: data.id };
}

export async function updateLeadAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  if (!id) return { error: "Thiếu lead." };
  const status = formText(formData, "status") || "new";
  const { error } = await supabase
    .from("leads")
    .update({
      company_id: formOptionalId(formData, "company_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      status,
      source: formText(formData, "source"),
      score: formData.get("score") ? formInt(formData, "score") : null,
      score_reason: formText(formData, "score_reason") || null,
      next_action_at: formText(formData, "next_action_at") || null,
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${id}`);
  return { ok: true as const };
}

export async function qualifyLeadAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const leadId = formText(formData, "lead_id");
  const title = formText(formData, "title");
  const companyId = formOptionalId(formData, "company_id");
  if (!leadId || !title || !companyId) return { error: "Cần company, lead và tên deal." };

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("is_default", true)
    .maybeSingle();
  const pipelineId = formOptionalId(formData, "pipeline_id") || pipeline?.id;
  if (!pipelineId) return { error: "Chưa có pipeline." };

  let stageId = formOptionalId(formData, "stage_id");
  if (!stageId) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id, probability")
      .eq("pipeline_id", pipelineId)
      .order("position")
      .limit(1)
      .maybeSingle();
    stageId = stage?.id || null;
  }
  if (!stageId) return { error: "Chưa có stage." };

  const { data: stage } = await supabase.from("pipeline_stages").select("probability").eq("id", stageId).single();
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      workspace_id: context.workspaceId,
      company_id: companyId,
      primary_contact_id: formOptionalId(formData, "contact_id"),
      pipeline_id: pipelineId,
      stage_id: stageId,
      owner_user_id: context.userId,
      title,
      amount: formInt(formData, "amount"),
      probability: stage?.probability ?? 10,
      expected_close_date: formText(formData, "expected_close_date") || null,
      source: "lead",
    })
    .select("id")
    .single();
  if (error || !deal) return { error: error?.message || "Không tạo được deal." };

  await supabase
    .from("leads")
    .update({ status: "qualified", converted_deal_id: deal.id })
    .eq("id", leadId)
    .eq("workspace_id", context.workspaceId);

  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId,
    contactId: formOptionalId(formData, "contact_id"),
    leadId,
    dealId: deal.id,
    activityType: "lead_qualified",
    title: `Qualified lead → ${title}`,
  });
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId,
    dealId: deal.id,
    activityType: "deal_created",
    title: `Deal created from lead: ${title}`,
  });
  revalidatePath("/app/leads");
  revalidatePath("/app/deals");
  return { ok: true as const, id: deal.id };
}
