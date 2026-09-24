"use server";

import { revalidatePath } from "next/cache";
import { recordActivity, withWorkspace } from "@/lib/events";
import { asJoined, formOptionalId, formText, TASK_STATUSES, TASK_TYPES } from "@/lib/crm";
import type { Database } from "@/lib/database.types";

function labelize(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Note";
}

export async function listTasks() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("tasks")
    .select("*, companies(name), deals(title), contacts(display_name)")
    .eq("workspace_id", context.workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });
  return asJoined<
    Array<
      Database["public"]["Tables"]["tasks"]["Row"] & {
        companies: { name: string } | null;
        deals: { title: string } | null;
        contacts: { display_name: string } | null;
      }
    >
  >(data || []);
}

export async function listDealTasks(dealId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("deal_id", dealId)
    .order("due_at", { ascending: true });
  return data || [];
}

export async function createTaskAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const title = formText(formData, "title");
  if (!title) return { error: "Cần tiêu đề task." };
  const type = formText(formData, "type") || "follow_up";
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: context.workspaceId,
      assigned_to: formOptionalId(formData, "assigned_to") || context.userId,
      deal_id: formOptionalId(formData, "deal_id"),
      company_id: formOptionalId(formData, "company_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      type: TASK_TYPES.includes(type as (typeof TASK_TYPES)[number]) ? type : "follow_up",
      title,
      description: formText(formData, "description") || null,
      priority: formText(formData, "priority") || "medium",
      due_at: formText(formData, "due_at") || null,
      created_by: context.userId,
    })
    .select("id, deal_id, company_id, contact_id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được task." };

  if (data.deal_id) {
    await supabase.from("deals").update({ next_activity_at: formText(formData, "due_at") || null }).eq("id", data.deal_id);
  }

  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: data.company_id,
    contactId: data.contact_id,
    dealId: data.deal_id,
    taskId: data.id,
    activityType: "task_created",
    title: `Task: ${title}`,
  });
  revalidatePath("/app/tasks");
  if (data.deal_id) revalidatePath(`/app/deals/${data.deal_id}`);
  return { ok: true as const, id: data.id };
}

export async function completeTaskAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const status = formText(formData, "status") || "completed";
  if (!id) return { error: "Thiếu task." };
  const completed = status === "completed";
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number]) ? status : "completed",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .select("id, title, deal_id, company_id")
    .single();
  if (error || !data) return { error: error?.message || "Không cập nhật được task." };
  if (completed) {
    await recordActivity({
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      companyId: data.company_id,
      dealId: data.deal_id,
      taskId: data.id,
      activityType: "task_completed",
      title: `Completed: ${data.title}`,
    });
  }
  revalidatePath("/app/tasks");
  revalidatePath("/app");
  if (data.deal_id) revalidatePath(`/app/deals/${data.deal_id}`);
  return { ok: true as const };
}

export async function listActivities(filters: { companyId?: string; contactId?: string; dealId?: string; leadId?: string }) {
  const { context, supabase } = await withWorkspace();
  let query = supabase
    .from("activities")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.dealId) query = query.eq("deal_id", filters.dealId);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);
  const { data } = await query;
  return data || [];
}

export async function addNoteAction(formData: FormData) {
  const { context } = await withWorkspace();
  const activityType = formText(formData, "activity_type") || "note";
  const title = formText(formData, "title") || labelize(activityType);
  const body = formText(formData, "body");
  if (!body) return { error: "Nội dung ghi chú trống." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: formOptionalId(formData, "company_id"),
    contactId: formOptionalId(formData, "contact_id"),
    dealId: formOptionalId(formData, "deal_id"),
    leadId: formOptionalId(formData, "lead_id"),
    activityType,
    title,
    body,
    isSystem: false,
  });
  const dealId = formOptionalId(formData, "deal_id");
  const companyId = formOptionalId(formData, "company_id");
  const leadId = formOptionalId(formData, "lead_id");
  const contactId = formOptionalId(formData, "contact_id");
  if (dealId) revalidatePath(`/app/deals/${dealId}`);
  if (companyId) revalidatePath(`/app/companies/${companyId}`);
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
  if (contactId) revalidatePath(`/app/contacts/${contactId}`);
  return { ok: true as const };
}
