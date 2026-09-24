"use server";

import { revalidatePath } from "next/cache";
import { recordActivity, withWorkspace } from "@/lib/events";
import { asJoined, DEAL_TYPES, formInt, formOptionalId, formText } from "@/lib/crm";
import type { Database } from "@/lib/database.types";

type DealRow = Database["public"]["Tables"]["deals"]["Row"];

export type DealListItem = DealRow & {
  companies: { name: string; logo_path: string } | null;
  pipeline_stages: { name: string; stage_type: string; position: number; probability: number } | null;
};

export async function listPipelines() {
  const { context, supabase } = await withWorkspace();
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("created_at");
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("position");
  return { pipelines: pipelines || [], stages: stages || [] };
}

export async function listDeals() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("deals")
    .select("*, companies(name, logo_path), contacts:primary_contact_id(display_name), pipeline_stages(name, stage_type, position, probability)")
    .eq("workspace_id", context.workspaceId)
    .order("updated_at", { ascending: false });
  return asJoined<DealListItem[]>(data || []);
}

export async function getDeal(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("deals")
    .select("*, companies(name, logo_path), contacts:primary_contact_id(display_name, email, phone)")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  return asJoined<
    | (DealRow & {
        companies: { name: string; logo_path: string } | null;
        contacts: { display_name: string; email: string; phone: string } | null;
      })
    | null
  >(data);
}

export async function listDealStakeholders(dealId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("deal_contacts")
    .select("*, contacts(display_name, email, job_title)")
    .eq("workspace_id", context.workspaceId)
    .eq("deal_id", dealId);
  return asJoined<
    Array<
      Database["public"]["Tables"]["deal_contacts"]["Row"] & {
        contacts: { display_name: string; email: string; job_title: string } | null;
      }
    >
  >(data || []);
}

export async function createDealAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const title = formText(formData, "title");
  const companyId = formOptionalId(formData, "company_id");
  if (!title || !companyId) return { error: "Cần tên deal và công ty." };

  const { pipelines, stages } = await listPipelines();
  const pipelineId = formOptionalId(formData, "pipeline_id") || pipelines.find((item) => item.is_default)?.id || pipelines[0]?.id;
  if (!pipelineId) return { error: "Chưa có pipeline." };
  const pipelineStages = stages.filter((item) => item.pipeline_id === pipelineId).sort((a, b) => a.position - b.position);
  const stageId = formOptionalId(formData, "stage_id") || pipelineStages[0]?.id;
  if (!stageId) return { error: "Chưa có stage." };
  const stage = pipelineStages.find((item) => item.id === stageId);

  const dealType = formText(formData, "deal_type") || "sales";
  const { data, error } = await supabase
    .from("deals")
    .insert({
      workspace_id: context.workspaceId,
      company_id: companyId,
      primary_contact_id: formOptionalId(formData, "primary_contact_id"),
      pipeline_id: pipelineId,
      stage_id: stageId,
      owner_user_id: context.userId,
      title,
      description: formText(formData, "description"),
      deal_type: DEAL_TYPES.includes(dealType as (typeof DEAL_TYPES)[number]) ? dealType : "sales",
      amount: formInt(formData, "amount"),
      probability: stage?.probability ?? 10,
      expected_close_date: formText(formData, "expected_close_date") || null,
      priority: formText(formData, "priority") || "medium",
      source: formText(formData, "source") || "manual",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được deal." };

  const contactId = formOptionalId(formData, "primary_contact_id");
  if (contactId) {
    await supabase.from("deal_contacts").insert({
      workspace_id: context.workspaceId,
      deal_id: data.id,
      contact_id: contactId,
      stakeholder_role: "other",
      is_primary: true,
    });
  }

  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId,
    contactId,
    dealId: data.id,
    activityType: "deal_created",
    title: `Deal created: ${title}`,
  });
  revalidatePath("/app/deals");
  return { ok: true as const, id: data.id };
}

export async function updateDealAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const title = formText(formData, "title");
  if (!id || !title) return { error: "Thiếu deal." };
  const { error } = await supabase
    .from("deals")
    .update({
      title,
      description: formText(formData, "description"),
      amount: formInt(formData, "amount"),
      expected_close_date: formText(formData, "expected_close_date") || null,
      priority: formText(formData, "priority") || "medium",
      deal_type: formText(formData, "deal_type") || "sales",
      lost_reason: formText(formData, "lost_reason") || null,
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/deals");
  revalidatePath(`/app/deals/${id}`);
  return { ok: true as const };
}

export async function moveDealStageAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const dealId = formText(formData, "deal_id");
  const stageId = formText(formData, "stage_id");
  if (!dealId || !stageId) return { error: "Thiếu deal hoặc stage." };

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("id", stageId)
    .eq("workspace_id", context.workspaceId)
    .single();
  if (!stage) return { error: "Stage không hợp lệ." };

  const patch: Record<string, unknown> = {
    stage_id: stageId,
    probability: stage.probability,
  };
  if (stage.stage_type === "won") {
    patch.won_at = new Date().toISOString();
    patch.lost_at = null;
  } else if (stage.stage_type === "lost") {
    patch.lost_at = new Date().toISOString();
    patch.won_at = null;
    patch.lost_reason = formText(formData, "lost_reason") || null;
  } else {
    patch.won_at = null;
    patch.lost_at = null;
  }

  const { error } = await supabase
    .from("deals")
    .update(patch as Database["public"]["Tables"]["deals"]["Update"])
    .eq("id", dealId)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };

  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    dealId,
    activityType: "stage_changed",
    title: `Stage → ${stage.name}`,
    metadata: { stage_id: stageId, stage_type: stage.stage_type },
  });
  revalidatePath("/app/deals");
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true as const };
}

export async function addDealStakeholderAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const dealId = formText(formData, "deal_id");
  const contactId = formOptionalId(formData, "contact_id");
  if (!dealId || !contactId) return { error: "Cần deal và contact." };
  const isPrimary = formText(formData, "is_primary") === "on";
  if (isPrimary) {
    await supabase.from("deal_contacts").update({ is_primary: false }).eq("deal_id", dealId);
    await supabase.from("deals").update({ primary_contact_id: contactId }).eq("id", dealId);
  }
  const { error } = await supabase.from("deal_contacts").upsert({
    workspace_id: context.workspaceId,
    deal_id: dealId,
    contact_id: contactId,
    stakeholder_role: formText(formData, "stakeholder_role") || "other",
    influence_level: formText(formData, "influence_level") || "unknown",
    relationship_strength: formText(formData, "relationship_strength") || "unknown",
    is_primary: isPrimary,
    notes: formText(formData, "notes"),
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true as const };
}
