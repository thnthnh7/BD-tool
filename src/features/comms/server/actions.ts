"use server";

import { revalidatePath } from "next/cache";
import { formOptionalId, formText } from "@/lib/crm";
import { recordActivity, withWorkspace } from "@/lib/events";
import { requireModule } from "@/lib/auth/session";

export async function listCommunications() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("communications")
    .select("*, companies(name), contacts(display_name)")
    .eq("workspace_id", context.workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(100);
  return data || [];
}

export async function logCommunicationAction(formData: FormData) {
  await requireModule("inbox");
  const { context, supabase } = await withWorkspace();
  const subject = formText(formData, "subject");
  if (!subject) return { error: "Cần subject." };
  const { data, error } = await supabase
    .from("communications")
    .insert({
      workspace_id: context.workspaceId,
      provider: "manual",
      direction: formText(formData, "direction") || "outbound",
      subject,
      body: formText(formData, "body"),
      from_address: formText(formData, "from_address") || context.email,
      to_address: formText(formData, "to_address"),
      company_id: formOptionalId(formData, "company_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      deal_id: formOptionalId(formData, "deal_id"),
      lead_id: formOptionalId(formData, "lead_id"),
    })
    .select("id, company_id, contact_id, deal_id")
    .single();
  if (error || !data) return { error: error?.message || "Không ghi được email." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    companyId: data.company_id,
    contactId: data.contact_id,
    dealId: data.deal_id,
    activityType: formText(formData, "direction") === "inbound" ? "email_received" : "email_sent",
    title: subject,
    body: formText(formData, "body"),
  });
  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function listMeetings() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("meetings")
    .select("*, companies(name), contacts(display_name)")
    .eq("workspace_id", context.workspaceId)
    .order("starts_at", { ascending: true });
  return data || [];
}

export async function createMeetingAction(formData: FormData) {
  await requireModule("calendar");
  const { context, supabase } = await withWorkspace();
  const title = formText(formData, "title");
  const startsAt = formText(formData, "starts_at");
  if (!title || !startsAt) return { error: "Cần tiêu đề và thời gian." };
  const { error } = await supabase.from("meetings").insert({
    workspace_id: context.workspaceId,
    title,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: formText(formData, "ends_at") ? new Date(formText(formData, "ends_at")).toISOString() : null,
    location: formText(formData, "location"),
    notes: formText(formData, "notes"),
    company_id: formOptionalId(formData, "company_id"),
    contact_id: formOptionalId(formData, "contact_id"),
    deal_id: formOptionalId(formData, "deal_id"),
    owner_user_id: context.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/calendar");
  return { ok: true as const };
}

export async function listIntegrations() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase.from("integration_connections").select("*").eq("workspace_id", context.workspaceId);
  return data || [];
}

export async function upsertIntegrationAction(formData: FormData) {
  const provider = formText(formData, "provider");
  await requireModule(provider.includes("calendar") ? "calendar" : "inbox");
  const { context, supabase } = await withWorkspace();
  if (!provider) return { error: "Thiếu provider." };
  const { error } = await supabase.from("integration_connections").upsert(
    {
      workspace_id: context.workspaceId,
      provider,
      status: "disconnected",
      account_email: formText(formData, "account_email"),
      created_by: context.userId,
      metadata: { note: "OAuth connect is prepared; credentials are not stored until Phase 3 apps are registered." },
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) return { error: error.message };
  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function listNotifications() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
    .limit(40);
  return data || [];
}

export async function markNotificationReadAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", formText(formData, "id"))
    .eq("workspace_id", context.workspaceId);
  revalidatePath("/app");
  return { ok: true as const };
}

export async function listSequences() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase.from("sequences").select("*").eq("workspace_id", context.workspaceId).order("updated_at", { ascending: false });
  return data || [];
}

export async function getSequence(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data: sequence } = await supabase.from("sequences").select("*").eq("id", id).eq("workspace_id", context.workspaceId).maybeSingle();
  if (!sequence) return null;
  const [{ data: steps }, { data: enrollments }] = await Promise.all([
    supabase.from("sequence_steps").select("*").eq("sequence_id", id).order("position"),
    supabase.from("sequence_enrollments").select("*, companies(name), contacts(display_name)").eq("sequence_id", id),
  ]);
  return { sequence, steps: steps || [], enrollments: enrollments || [] };
}

export async function createSequenceAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const name = formText(formData, "name");
  if (!name) return { error: "Cần tên sequence." };
  const { data, error } = await supabase
    .from("sequences")
    .insert({
      workspace_id: context.workspaceId,
      name,
      description: formText(formData, "description"),
      status: "draft",
      owner_user_id: context.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được sequence." };
  revalidatePath("/app/sequences");
  return { ok: true as const, id: data.id };
}

export async function addSequenceStepAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const sequenceId = formText(formData, "sequence_id");
  const { data: last } = await supabase
    .from("sequence_steps")
    .select("position")
    .eq("sequence_id", sequenceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("sequence_steps").insert({
    workspace_id: context.workspaceId,
    sequence_id: sequenceId,
    position: (last?.position || 0) + 1,
    step_type: formText(formData, "step_type") || "email",
    delay_days: Number(formData.get("delay_days") || 0),
    subject: formText(formData, "subject"),
    body: formText(formData, "body"),
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/sequences/${sequenceId}`);
  return { ok: true as const };
}

export async function enrollSequenceAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const sequenceId = formText(formData, "sequence_id");
  const { error } = await supabase.from("sequence_enrollments").insert({
    workspace_id: context.workspaceId,
    sequence_id: sequenceId,
    company_id: formOptionalId(formData, "company_id"),
    contact_id: formOptionalId(formData, "contact_id"),
    lead_id: formOptionalId(formData, "lead_id"),
    status: "active",
    current_step: 0,
    next_run_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/sequences/${sequenceId}`);
  return { ok: true as const };
}

export async function upsertAccountPlanAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const companyId = formText(formData, "company_id");
  if (!companyId) return { error: "Thiếu company." };
  const { error } = await supabase.from("account_plans").upsert(
    {
      workspace_id: context.workspaceId,
      company_id: companyId,
      objective: formText(formData, "objective"),
      strategy: formText(formData, "strategy"),
      risks: formText(formData, "risks"),
      next_review_at: formText(formData, "next_review_at") || null,
      updated_by: context.userId,
    },
    { onConflict: "workspace_id,company_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true as const };
}

export async function getAccountPlan(companyId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("account_plans")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}
