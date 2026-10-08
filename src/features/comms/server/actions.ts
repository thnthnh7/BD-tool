"use server";

import { revalidatePath } from "next/cache";
import { formOptionalId, formText } from "@/lib/crm";
import { recordActivity, withWorkspace } from "@/lib/events";
import { requireModule } from "@/lib/auth/session";
import { getEngagementAccessToken } from "@/features/comms/server/accounts";
import { createProviderEvent, sendProviderEmail, type EngagementProvider } from "@/features/comms/server/providers";

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

export async function sendCommunicationAction(formData: FormData) {
  await requireModule("inbox");
  const { context, supabase } = await withWorkspace();
  const accountId = formText(formData, "account_id");
  const to = formText(formData, "to_address").trim().toLowerCase();
  const subject = formText(formData, "subject");
  const body = formText(formData, "body");
  if (!accountId || !to || !subject) return { error: "Cần mailbox, người nhận và subject." };
  const { data: account } = await supabase.from("engagement_accounts").select("id, provider, account_email, status").eq("id", accountId).eq("workspace_id", context.workspaceId).maybeSingle();
  if (!account || account.status !== "connected") return { error: "Mailbox chưa kết nối hoặc cần reconnect." };
  const { data: suppression } = await supabase.from("engagement_suppressions").select("id").eq("workspace_id", context.workspaceId).ilike("email", to).maybeSingle();
  if (suppression) return { error: "Địa chỉ này đang nằm trong suppression list." };
  try {
    const accessToken = await getEngagementAccessToken(account.id);
    const sent = await sendProviderEmail({ provider: account.provider as EngagementProvider, accessToken, from: account.account_email, to, subject, body });
    const { data, error } = await supabase.from("communications").insert({
      workspace_id: context.workspaceId,
      provider: account.provider,
      direction: "outbound",
      subject,
      body,
      from_address: account.account_email,
      to_address: to,
      company_id: formOptionalId(formData, "company_id"),
      contact_id: formOptionalId(formData, "contact_id"),
      engagement_account_id: account.id,
      provider_message_id: sent.messageId,
      provider_thread_id: sent.threadId || null,
      delivery_status: "sent",
      synced_at: new Date().toISOString(),
    }).select("company_id, contact_id").single();
    if (error || !data) return { error: error?.message || "Email sent but could not be recorded." };
    await recordActivity({ workspaceId: context.workspaceId, actorUserId: context.userId, companyId: data.company_id, contactId: data.contact_id, activityType: "email_sent", title: subject, body });
    revalidatePath("/app/inbox");
    return { ok: true as const };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Không gửi được email." };
  }
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
  const accountId = formText(formData, "account_id");
  const contactId = formOptionalId(formData, "contact_id");
  const startsIso = new Date(startsAt).toISOString();
  const endsIso = formText(formData, "ends_at") ? new Date(formText(formData, "ends_at")).toISOString() : new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString();
  let providerEvent: { eventId: string; etag: string; htmlLink: string } | null = null;
  let account: { id: string; provider: string } | null = null;
  if (accountId) {
    const { data } = await supabase.from("engagement_accounts").select("id, provider, status").eq("id", accountId).eq("workspace_id", context.workspaceId).maybeSingle();
    if (!data || data.status !== "connected") return { error: "Calendar account chưa kết nối hoặc cần reconnect." };
    account = data;
    const { data: contact } = contactId ? await supabase.from("contacts").select("email").eq("id", contactId).maybeSingle() : { data: null };
    try {
      const token = await getEngagementAccessToken(data.id);
      providerEvent = await createProviderEvent({ provider: data.provider as EngagementProvider, accessToken: token, title, startsAt: startsIso, endsAt: endsIso, timezone: "UTC", location: formText(formData, "location"), notes: formText(formData, "notes"), attendeeEmail: contact?.email || undefined });
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : "Không tạo được calendar event." };
    }
  }
  const { error } = await supabase.from("meetings").insert({
    workspace_id: context.workspaceId,
    title,
    starts_at: startsIso,
    ends_at: endsIso,
    location: formText(formData, "location"),
    notes: formText(formData, "notes"),
    company_id: formOptionalId(formData, "company_id"),
    contact_id: contactId,
    deal_id: formOptionalId(formData, "deal_id"),
    owner_user_id: context.userId,
    engagement_account_id: account?.id || null,
    provider_event_id: providerEvent?.eventId || null,
    provider_etag: providerEvent?.etag || null,
    conference_url: providerEvent?.htmlLink || null,
    sync_status: providerEvent ? "synced" : "local",
    provider_updated_at: providerEvent ? new Date().toISOString() : null,
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
    delay_minutes: Number(formData.get("delay_minutes") || 0),
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
  const contactId = formOptionalId(formData, "contact_id");
  const [{ data: sequence }, { data: contact }, { data: firstStep }] = await Promise.all([
    supabase.from("sequences").select("status, sender_account_id").eq("id", sequenceId).eq("workspace_id", context.workspaceId).maybeSingle(),
    contactId ? supabase.from("contacts").select("email").eq("id", contactId).eq("workspace_id", context.workspaceId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("sequence_steps").select("delay_days, delay_minutes").eq("sequence_id", sequenceId).eq("position", 1).maybeSingle(),
  ]);
  if (!sequence || sequence.status !== "active") return { error: "Activate sequence trước khi enroll contact." };
  if (!sequence.sender_account_id) return { error: "Chọn sending account trước khi enroll." };
  if (!contactId || !contact?.email) return { error: "Contact cần có email để enroll." };
  const email = contact.email.trim().toLowerCase();
  const { data: suppression } = await supabase.from("engagement_suppressions").select("id").eq("workspace_id", context.workspaceId).eq("email", email).maybeSingle();
  if (suppression) return { error: "Contact đang nằm trong suppression list." };
  if (!firstStep) return { error: "Sequence cần ít nhất một step." };
  const { error } = await supabase.from("sequence_enrollments").insert({
    workspace_id: context.workspaceId,
    sequence_id: sequenceId,
    company_id: formOptionalId(formData, "company_id"),
    contact_id: contactId,
    lead_id: formOptionalId(formData, "lead_id"),
    status: "active",
    current_step: 0,
    contact_email: email,
    next_run_at: new Date(Date.now() + firstStep.delay_days * 86_400_000 + firstStep.delay_minutes * 60_000).toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/sequences/${sequenceId}`);
  return { ok: true as const };
}

export async function updateSequenceEnrollmentAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const enrollmentId = formText(formData, "enrollment_id");
  const requested = formText(formData, "status");
  if (!enrollmentId || !["active", "paused", "stopped"].includes(requested)) return { error: "Invalid enrollment action." };
  const { data: enrollment } = await supabase.from("sequence_enrollments")
    .select("id, sequence_id, status")
    .eq("id", enrollmentId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!enrollment) return { error: "Enrollment not found." };
  if (enrollment.status === "completed") return { error: "A completed enrollment cannot be resumed." };
  const status = requested as "active" | "paused" | "stopped";
  const { error } = await supabase.from("sequence_enrollments").update({
    status,
    next_run_at: status === "active" ? new Date().toISOString() : null,
    paused_reason: status === "active" ? null : status === "paused" ? "Paused manually." : "Stopped manually.",
    last_error: status === "active" ? null : undefined,
  }).eq("id", enrollment.id);
  if (error) return { error: error.message };
  revalidatePath(`/app/sequences/${enrollment.sequence_id}`);
  return { ok: true as const };
}

export async function configureSequenceAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const sequenceId = formText(formData, "sequence_id");
  const status = formText(formData, "status");
  if (!sequenceId || !["draft", "active", "paused", "archived"].includes(status)) return { error: "Cấu hình sequence không hợp lệ." };
  const senderAccountId = formOptionalId(formData, "sender_account_id");
  if (status === "active") {
    const [{ data: step }, { data: account }] = await Promise.all([
      supabase.from("sequence_steps").select("id").eq("sequence_id", sequenceId).limit(1).maybeSingle(),
      senderAccountId ? supabase.from("engagement_accounts").select("id, status").eq("id", senderAccountId).eq("workspace_id", context.workspaceId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!step) return { error: "Thêm ít nhất một step trước khi activate." };
    if (!account || account.status !== "connected") return { error: "Chọn một sending account đang connected." };
  }
  const { error } = await supabase.from("sequences").update({
    status,
    sender_account_id: senderAccountId,
    timezone: formText(formData, "timezone") || "Asia/Ho_Chi_Minh",
    daily_send_limit: Math.max(1, Math.min(500, Number(formData.get("daily_send_limit") || 50))),
    stop_on_reply: String(formData.get("stop_on_reply") || "") === "on",
  }).eq("id", sequenceId).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath(`/app/sequences/${sequenceId}`);
  revalidatePath("/app/sequences");
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
