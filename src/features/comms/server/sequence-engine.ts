import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEngagementAccessToken } from "@/features/comms/server/accounts";
import { sendProviderEmail, type EngagementProvider } from "@/features/comms/server/providers";
import { syncEngagementAccounts } from "@/features/comms/server/sync-engine";
import { isInsideSendingWindow, nextSendingWindow } from "@/features/comms/server/sequence-schedule";
import { workspaceHasFeature } from "@/features/comms/server/feature-access";

function plusDelay(days: number, minutes: number) {
  return new Date(Date.now() + Math.max(0, days) * 86_400_000 + Math.max(0, minutes) * 60_000).toISOString();
}

function renderTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/{{\s*([a-z_]+)\s*}}/gi, (_, key: string) => variables[key.toLowerCase()] ?? "");
}

export async function scheduleDueSequenceJobs(limit = 100) {
  const admin = createAdminClient();
  const { data: enrollments } = await admin
    .from("sequence_enrollments")
    .select("id, workspace_id, sequence_id, current_step, next_run_at, status")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at")
    .limit(limit);

  let queued = 0;
  const featureCache = new Map<string, boolean>();
  for (const enrollment of enrollments || []) {
    let enabled = featureCache.get(enrollment.workspace_id);
    if (enabled === undefined) {
      enabled = await workspaceHasFeature(enrollment.workspace_id, "sequences");
      featureCache.set(enrollment.workspace_id, enabled);
    }
    if (!enabled) continue;
    const [{ data: sequence }, { data: step }] = await Promise.all([
      admin.from("sequences").select("id, status, sender_account_id").eq("id", enrollment.sequence_id).maybeSingle(),
      admin.from("sequence_steps").select("id, step_type").eq("sequence_id", enrollment.sequence_id).eq("position", enrollment.current_step + 1).maybeSingle(),
    ]);
    if (!sequence || sequence.status !== "active") continue;
    if (!step) {
      await admin.from("sequence_enrollments").update({ status: "completed", completed_at: new Date().toISOString(), next_run_at: null }).eq("id", enrollment.id);
      continue;
    }
    const { error } = await admin.from("engagement_jobs").insert({
      workspace_id: enrollment.workspace_id,
      sequence_id: enrollment.sequence_id,
      enrollment_id: enrollment.id,
      step_id: step.id,
      account_id: sequence.sender_account_id,
      job_type: step.step_type,
      idempotency_key: `sequence:${enrollment.id}:step:${step.id}`,
      available_at: enrollment.next_run_at || new Date().toISOString(),
    });
    if (!error) queued += 1;
  }
  return queued;
}

async function pauseEnrollment(enrollmentId: string, reason: string) {
  await createAdminClient().from("sequence_enrollments").update({ status: "paused", paused_reason: reason, last_error: reason, next_run_at: null }).eq("id", enrollmentId);
}

async function finishStep(job: { id: string; enrollment_id: string | null; sequence_id: string | null }, position: number) {
  const admin = createAdminClient();
  if (!job.enrollment_id || !job.sequence_id) return;
  const { data: nextStep } = await admin
    .from("sequence_steps")
    .select("delay_days, delay_minutes")
    .eq("sequence_id", job.sequence_id)
    .eq("position", position + 1)
    .maybeSingle();
  await admin.from("sequence_enrollments").update({
    current_step: position,
    next_run_at: nextStep ? plusDelay(nextStep.delay_days, nextStep.delay_minutes) : null,
    status: nextStep ? "active" : "completed",
    completed_at: nextStep ? null : new Date().toISOString(),
    paused_reason: null,
    last_error: null,
  }).eq("id", job.enrollment_id);
  await admin.from("engagement_jobs").update({ status: "completed", completed_at: new Date().toISOString(), locked_at: null, last_error: null }).eq("id", job.id);
}

async function processSequenceJob(job: {
  id: string;
  workspace_id: string;
  sequence_id: string | null;
  enrollment_id: string | null;
  step_id: string | null;
  account_id: string | null;
  attempt_count: number;
  max_attempts: number;
  payload: unknown;
}) {
  const admin = createAdminClient();
  if (!job.sequence_id || !job.enrollment_id || !job.step_id) throw new Error("Sequence job is incomplete.");
  if (!(await workspaceHasFeature(job.workspace_id, "sequences"))) {
    await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null, last_error: "Sequence access is not enabled for this workspace." }).eq("id", job.id);
    await pauseEnrollment(job.enrollment_id, "Sequence access is not enabled for this workspace.");
    return;
  }
  const [{ data: sequence }, { data: enrollment }, { data: step }] = await Promise.all([
    admin.from("sequences").select("status, owner_user_id, sender_account_id, daily_send_limit, timezone, sending_window").eq("id", job.sequence_id).maybeSingle(),
    admin.from("sequence_enrollments").select("status, contact_id, company_id, contact_email").eq("id", job.enrollment_id).maybeSingle(),
    admin.from("sequence_steps").select("position, step_type, subject, body").eq("id", job.step_id).maybeSingle(),
  ]);
  if (!sequence || !enrollment || !step || sequence.status !== "active" || enrollment.status !== "active") {
    await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null }).eq("id", job.id);
    return;
  }

  const [{ data: contact }, { data: company }] = await Promise.all([
    enrollment.contact_id ? admin.from("contacts").select("display_name, first_name, last_name, email").eq("id", enrollment.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    enrollment.company_id ? admin.from("companies").select("name").eq("id", enrollment.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const email = (enrollment.contact_email || contact?.email || "").trim().toLowerCase();
  const variables = {
    first_name: contact?.first_name || "",
    last_name: contact?.last_name || "",
    contact_name: contact?.display_name || "",
    company_name: company?.name || "",
  };

  if (step.step_type === "wait") {
    await finishStep(job, step.position);
    return;
  }

  if (step.step_type === "task") {
    await admin.from("tasks").insert({
      workspace_id: job.workspace_id,
      assigned_to: sequence.owner_user_id,
      company_id: enrollment.company_id,
      contact_id: enrollment.contact_id,
      type: "follow_up",
      title: renderTemplate(step.subject || "Sequence follow-up", variables),
      description: renderTemplate(step.body || "", variables),
      created_by: sequence.owner_user_id,
    });
    await finishStep(job, step.position);
    return;
  }

  if (!email) {
    await pauseEnrollment(job.enrollment_id, "Contact does not have an email address.");
    await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null }).eq("id", job.id);
    return;
  }
  const { data: suppression } = await admin.from("engagement_suppressions").select("id").eq("workspace_id", job.workspace_id).ilike("email", email).maybeSingle();
  if (suppression) {
    await pauseEnrollment(job.enrollment_id, "Contact is on the suppression list.");
    await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null }).eq("id", job.id);
    return;
  }
  const accountId = sequence.sender_account_id || job.account_id;
  if (!accountId) {
    await pauseEnrollment(job.enrollment_id, "Connect and select a sending account before running this sequence.");
    throw new Error("No sending account configured.");
  }
  const { data: account } = await admin.from("engagement_accounts").select("provider, account_email, status").eq("id", accountId).maybeSingle();
  if (!account) {
    await pauseEnrollment(job.enrollment_id, "The sending account needs to be reconnected.");
    throw new Error("Sending account was not found.");
  }
  const subject = renderTemplate(step.subject || "", variables);
  const body = renderTemplate(step.body || "", variables);
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
    ? job.payload as Record<string, unknown>
    : {};
  let sent = {
    messageId: typeof payload.sent_message_id === "string" ? payload.sent_message_id : "",
    threadId: typeof payload.sent_thread_id === "string" ? payload.sent_thread_id : "",
  };
  if (!sent.messageId) {
    if (account.status !== "connected") {
      await pauseEnrollment(job.enrollment_id, "The sending account needs to be reconnected.");
      throw new Error("Sending account is not connected.");
    }
    if (payload.dispatch_started_at) {
      const reason = "Delivery result is uncertain; review the mailbox before resuming this enrollment.";
      await pauseEnrollment(job.enrollment_id, reason);
      await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null, last_error: reason }).eq("id", job.id);
      return;
    }
    const sendingWindow = sequence.sending_window && typeof sequence.sending_window === "object" && !Array.isArray(sequence.sending_window)
      ? sequence.sending_window as { days?: number[]; start?: string; end?: string }
      : {};
    const now = new Date();
    if (!isInsideSendingWindow(now, sequence.timezone, sendingWindow)) {
      await admin.from("engagement_jobs").update({
        status: "failed",
        available_at: nextSendingWindow(now, sequence.timezone, sendingWindow).toISOString(),
        attempt_count: 0,
        locked_at: null,
        last_error: "Waiting for the configured sending window.",
      }).eq("id", job.id);
      return;
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await admin.from("communications").select("id", { count: "exact", head: true })
      .eq("engagement_account_id", accountId).eq("direction", "outbound").gte("occurred_at", startOfDay.toISOString());
    if ((count || 0) >= sequence.daily_send_limit) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await admin.from("engagement_jobs").update({
        status: "failed",
        available_at: nextSendingWindow(tomorrow, sequence.timezone, sendingWindow).toISOString(),
        attempt_count: 0,
        locked_at: null,
        last_error: "Waiting for the next daily mailbox allowance.",
      }).eq("id", job.id);
      return;
    }
    const accessToken = await getEngagementAccessToken(accountId);
    const dispatchStartedAt = new Date().toISOString();
    await admin.from("engagement_jobs").update({ payload: { ...payload, dispatch_started_at: dispatchStartedAt } }).eq("id", job.id);
    try {
      sent = await sendProviderEmail({ provider: account.provider as EngagementProvider, accessToken, from: account.account_email, to: email, subject, body });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Email delivery result is uncertain.";
      await pauseEnrollment(job.enrollment_id, reason);
      await admin.from("engagement_jobs").update({ status: "canceled", completed_at: new Date().toISOString(), locked_at: null, last_error: reason }).eq("id", job.id);
      return;
    }
    await admin.from("engagement_jobs").update({ payload: {
      ...payload,
      dispatch_started_at: dispatchStartedAt,
      sent_message_id: sent.messageId,
      sent_thread_id: sent.threadId,
    } }).eq("id", job.id);
  }
  const { error: communicationError } = await admin.from("communications").upsert({
    workspace_id: job.workspace_id,
    provider: account.provider,
    direction: "outbound",
    subject,
    body,
    from_address: account.account_email,
    to_address: email,
    company_id: enrollment.company_id,
    contact_id: enrollment.contact_id,
    engagement_account_id: accountId,
    provider_message_id: sent.messageId,
    provider_thread_id: sent.threadId || null,
    delivery_status: "sent",
    synced_at: new Date().toISOString(),
  }, { onConflict: "engagement_account_id,provider_message_id" });
  if (communicationError) throw new Error(communicationError.message);
  await finishStep(job, step.position);
}

export async function runEngagementWorker(batchSize = 20) {
  const admin = createAdminClient();
  const [queued, sync] = await Promise.all([
    scheduleDueSequenceJobs(),
    syncEngagementAccounts({ limit: 10 }),
  ]);
  const { data: jobs, error } = await admin.rpc("claim_engagement_jobs", { p_limit: batchSize });
  if (error) throw new Error(error.message);
  let completed = 0;
  let failed = 0;
  for (const job of jobs || []) {
    try {
      await processSequenceJob(job);
      completed += 1;
    } catch (cause) {
      failed += 1;
      const message = cause instanceof Error ? cause.message : "Engagement job failed";
      const finalAttempt = job.attempt_count >= job.max_attempts;
      await admin.from("engagement_jobs").update({
        status: finalAttempt ? "canceled" : "failed",
        last_error: message,
        locked_at: null,
        available_at: plusDelay(0, Math.min(60, 2 ** Math.max(1, job.attempt_count))),
        completed_at: finalAttempt ? new Date().toISOString() : null,
      }).eq("id", job.id);
      if (finalAttempt && job.enrollment_id) await pauseEnrollment(job.enrollment_id, message);
    }
  }
  return { queued, claimed: jobs?.length || 0, completed, failed, syncedAccounts: sync.length };
}
