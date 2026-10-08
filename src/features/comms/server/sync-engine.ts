import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEngagementAccessToken } from "@/features/comms/server/accounts";
import { listProviderCalendarEvents, listProviderMessages } from "@/features/comms/server/provider-sync";
import type { EngagementProvider } from "@/features/comms/server/providers";
import { workspaceHasFeature } from "@/features/comms/server/feature-access";

type Account = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  provider: string;
  account_email: string;
};

function syncStart(lastSyncedAt: string | null, firstSyncDays: number) {
  const fallback = Date.now() - firstSyncDays * 86_400_000;
  const previous = lastSyncedAt ? new Date(lastSyncedAt).getTime() - 10 * 60_000 : fallback;
  return new Date(Number.isFinite(previous) ? previous : fallback);
}

async function markSubscription(account: Account, resource: "mail" | "calendar", input: { status: "active" | "error"; error?: string }) {
  const admin = createAdminClient();
  await admin.from("engagement_subscriptions").upsert({
    workspace_id: account.workspace_id,
    account_id: account.id,
    resource,
    status: input.status,
    last_synced_at: input.status === "active" ? new Date().toISOString() : undefined,
    last_error: input.error || null,
  }, { onConflict: "account_id,resource" });
}

async function stopSequencesOnReply(workspaceId: string, email: string, repliedAt: string) {
  const admin = createAdminClient();
  const { data: enrollments } = await admin.from("sequence_enrollments")
    .select("id, sequence_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .ilike("contact_email", email);
  if (!enrollments?.length) return;
  const sequenceIds = [...new Set(enrollments.map((item) => item.sequence_id))];
  const { data: sequences } = await admin.from("sequences").select("id").in("id", sequenceIds).eq("stop_on_reply", true);
  const enabled = new Set((sequences || []).map((item) => item.id));
  const replyTime = new Date(repliedAt).getTime();
  const enrollmentIds = enrollments
    .filter((item) => enabled.has(item.sequence_id) && new Date(item.created_at).getTime() <= replyTime)
    .map((item) => item.id);
  if (!enrollmentIds.length) return;
  await admin.from("sequence_enrollments").update({
    status: "stopped",
    replied_at: repliedAt,
    paused_reason: "Stopped automatically after a reply.",
    next_run_at: null,
  }).in("id", enrollmentIds);
}

async function syncMailbox(account: Account, accessToken: string, lastSyncedAt: string | null) {
  const admin = createAdminClient();
  const { data: contacts } = await admin.from("contacts").select("id, company_id, email").eq("workspace_id", account.workspace_id).not("email", "is", null);
  const contactsByEmail = new Map((contacts || []).map((contact) => [String(contact.email || "").trim().toLowerCase(), contact]));
  const messages = await listProviderMessages({
    provider: account.provider as EngagementProvider,
    accessToken,
    accountEmail: account.account_email,
    since: syncStart(lastSyncedAt, 30),
  });
  for (const message of messages) {
    const otherEmail = message.direction === "inbound" ? message.from : message.to;
    const contact = contactsByEmail.get(otherEmail);
    const { error } = await admin.from("communications").upsert({
      workspace_id: account.workspace_id,
      provider: account.provider,
      direction: message.direction,
      subject: message.subject,
      body: message.body,
      snippet: message.snippet,
      from_address: message.from,
      to_address: message.to,
      company_id: contact?.company_id || null,
      contact_id: contact?.id || null,
      occurred_at: message.occurredAt,
      engagement_account_id: account.id,
      provider_message_id: message.providerMessageId,
      provider_thread_id: message.threadId,
      internet_message_id: message.internetMessageId,
      delivery_status: message.direction === "inbound" ? "received" : "sent",
      synced_at: new Date().toISOString(),
    }, { onConflict: "engagement_account_id,provider_message_id" });
    if (error) throw new Error(error.message);
    if (message.direction === "inbound" && message.from) {
      await stopSequencesOnReply(account.workspace_id, message.from, message.occurredAt);
    }
  }
  return messages.length;
}

async function syncCalendar(account: Account, accessToken: string, lastSyncedAt: string | null) {
  const admin = createAdminClient();
  const { data: contacts } = await admin.from("contacts").select("id, company_id, email").eq("workspace_id", account.workspace_id).not("email", "is", null);
  const contactsByEmail = new Map((contacts || []).map((contact) => [String(contact.email || "").trim().toLowerCase(), contact]));
  const events = await listProviderCalendarEvents({
    provider: account.provider as EngagementProvider,
    accessToken,
    since: syncStart(lastSyncedAt, 30),
  });
  for (const event of events) {
    const attendeeEmail = event.attendeeEmails.find((email) => email !== account.account_email.toLowerCase());
    const contact = attendeeEmail ? contactsByEmail.get(attendeeEmail) : undefined;
    const { error } = await admin.from("meetings").upsert({
      workspace_id: account.workspace_id,
      title: event.title,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      location: event.location,
      notes: event.notes,
      company_id: contact?.company_id || null,
      contact_id: contact?.id || null,
      owner_user_id: account.owner_user_id,
      engagement_account_id: account.id,
      provider_event_id: event.providerEventId,
      provider_etag: event.etag,
      timezone: event.timezone,
      attendees: event.attendeeEmails,
      conference_url: event.conferenceUrl,
      sync_status: "synced",
      provider_updated_at: event.providerUpdatedAt,
      deleted_at: event.deleted ? new Date().toISOString() : null,
    }, { onConflict: "engagement_account_id,provider_event_id" });
    if (error) throw new Error(error.message);
  }
  return events.length;
}

export async function syncEngagementAccount(account: Account) {
  const admin = createAdminClient();
  const [inboxEnabled, calendarEnabled, sequencesEnabled] = await Promise.all([
    workspaceHasFeature(account.workspace_id, "inbox"),
    workspaceHasFeature(account.workspace_id, "calendar"),
    workspaceHasFeature(account.workspace_id, "sequences"),
  ]);
  if (!inboxEnabled && !calendarEnabled && !sequencesEnabled) {
    return { messages: 0, events: 0, errors: [] as string[] };
  }
  const token = await getEngagementAccessToken(account.id);
  const { data: subscriptions } = await admin.from("engagement_subscriptions")
    .select("resource, last_synced_at")
    .eq("account_id", account.id);
  const lastSync = new Map((subscriptions || []).map((item) => [item.resource, item.last_synced_at]));
  let messages = 0;
  let events = 0;
  const errors: string[] = [];

  if (inboxEnabled || sequencesEnabled) {
    try {
      messages = await syncMailbox(account, token, lastSync.get("mail") || null);
      await markSubscription(account, "mail", { status: "active" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Mailbox sync failed.";
      errors.push(message);
      await markSubscription(account, "mail", { status: "error", error: message });
    }
  }
  if (calendarEnabled) {
    try {
      events = await syncCalendar(account, token, lastSync.get("calendar") || null);
      await markSubscription(account, "calendar", { status: "active" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Calendar sync failed.";
      errors.push(message);
      await markSubscription(account, "calendar", { status: "error", error: message });
    }
  }

  const now = new Date().toISOString();
  await admin.from("engagement_accounts").update({
    last_synced_at: errors.length < 2 ? now : undefined,
    last_error: errors.length ? errors.join(" ") : null,
  }).eq("id", account.id);
  return { messages, events, errors };
}

export async function syncEngagementAccounts(options: { workspaceId?: string; limit?: number } = {}) {
  const admin = createAdminClient();
  let query = admin.from("engagement_accounts")
    .select("id, workspace_id, owner_user_id, provider, account_email")
    .eq("status", "connected")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(options.limit || 10, 50)));
  if (options.workspaceId) query = query.eq("workspace_id", options.workspaceId);
  const { data: accounts, error } = await query;
  if (error) throw new Error(error.message);
  const results = [];
  for (const account of accounts || []) {
    try {
      results.push({ accountId: account.id, ...(await syncEngagementAccount(account)) });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Account sync failed.";
      await admin.from("engagement_accounts").update({ last_error: message }).eq("id", account.id);
      results.push({ accountId: account.id, messages: 0, events: 0, errors: [message] });
    }
  }
  return results;
}
