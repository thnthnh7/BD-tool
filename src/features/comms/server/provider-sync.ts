import "server-only";

import type { EngagementProvider } from "@/features/comms/server/providers";
import {
  cleanHtml,
  decodeBase64Url,
  extractEmail,
  type SyncedCalendarEvent,
  type SyncedMessage,
} from "@/features/comms/server/provider-normalization";

type Json = Record<string, unknown>;

async function providerFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const nested = payload.error as { message?: string } | string | undefined;
    throw new Error(typeof nested === "string" ? nested : nested?.message || `Provider sync failed (${response.status}).`);
  }
  return payload;
}

function gmailHeaders(payload: Json) {
  const headers = Array.isArray(payload.headers) ? payload.headers as Array<{ name?: string; value?: string }> : [];
  return Object.fromEntries(headers.map((header) => [String(header.name || "").toLowerCase(), String(header.value || "")]));
}

function gmailBody(payload: Json): string {
  const body = payload.body as { data?: string } | undefined;
  if (body?.data) return decodeBase64Url(body.data);
  const parts = Array.isArray(payload.parts) ? payload.parts as Json[] : [];
  const plain = parts.find((part) => part.mimeType === "text/plain");
  if (plain) return gmailBody(plain);
  const html = parts.find((part) => part.mimeType === "text/html");
  return html ? cleanHtml(gmailBody(html)) : "";
}

async function listGoogleMessages(accessToken: string, accountEmail: string, since: Date): Promise<SyncedMessage[]> {
  const after = Math.floor(since.getTime() / 1000);
  const list = await providerFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=after:${after}%20-label:drafts`, accessToken);
  const references = Array.isArray(list.messages) ? list.messages as Array<{ id?: string }> : [];
  const details = await Promise.all(references.filter((item) => item.id).map((item) =>
    providerFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id || "")}?format=full`, accessToken),
  ));
  return details.map((message) => {
    const payload = (message.payload || {}) as Json;
    const headers = gmailHeaders(payload);
    const from = extractEmail(headers.from || "");
    const to = extractEmail((headers.to || "").split(",")[0] || "");
    return {
      providerMessageId: String(message.id || ""),
      threadId: message.threadId ? String(message.threadId) : null,
      internetMessageId: headers["message-id"] || null,
      subject: headers.subject || "(No subject)",
      body: gmailBody(payload),
      snippet: String(message.snippet || ""),
      from,
      to,
      occurredAt: new Date(Number(message.internalDate || Date.now())).toISOString(),
      direction: from === accountEmail.toLowerCase() ? "outbound" as const : "inbound" as const,
    };
  }).filter((message) => message.providerMessageId);
}

async function listMicrosoftMessages(accessToken: string, accountEmail: string, since: Date): Promise<SyncedMessage[]> {
  const filter = encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`);
  const select = "id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,receivedDateTime";
  const [inbox, sent] = await Promise.all([
    providerFetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$filter=${filter}&$select=${select}`, accessToken),
    providerFetch(`https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=50&$orderby=receivedDateTime desc&$filter=${filter}&$select=${select}`, accessToken),
  ]);
  const messages = [
    ...(Array.isArray(inbox.value) ? inbox.value as Json[] : []),
    ...(Array.isArray(sent.value) ? sent.value as Json[] : []),
  ];
  return messages.map((message) => {
    const fromObject = ((message.from as Json | undefined)?.emailAddress || {}) as Json;
    const recipients = Array.isArray(message.toRecipients) ? message.toRecipients as Json[] : [];
    const toObject = ((recipients[0]?.emailAddress as Json | undefined) || {}) as Json;
    const from = String(fromObject.address || "").toLowerCase();
    return {
      providerMessageId: String(message.id || ""),
      threadId: message.conversationId ? String(message.conversationId) : null,
      internetMessageId: message.internetMessageId ? String(message.internetMessageId) : null,
      subject: String(message.subject || "(No subject)"),
      body: String(message.bodyPreview || ""),
      snippet: String(message.bodyPreview || ""),
      from,
      to: String(toObject.address || "").toLowerCase(),
      occurredAt: new Date(String(message.receivedDateTime || new Date().toISOString())).toISOString(),
      direction: from === accountEmail.toLowerCase() ? "outbound" as const : "inbound" as const,
    };
  }).filter((message) => message.providerMessageId);
}

export function listProviderMessages(input: { provider: EngagementProvider; accessToken: string; accountEmail: string; since: Date }) {
  return input.provider === "google"
    ? listGoogleMessages(input.accessToken, input.accountEmail, input.since)
    : listMicrosoftMessages(input.accessToken, input.accountEmail, input.since);
}

async function listGoogleEvents(accessToken: string, since: Date): Promise<SyncedCalendarEvent[]> {
  const end = new Date(Date.now() + 366 * 86_400_000);
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", "true");
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("timeMin", since.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  const payload = await providerFetch(url.toString(), accessToken);
  const events = Array.isArray(payload.items) ? payload.items as Json[] : [];
  return events.map((event) => {
    const start = (event.start || {}) as Json;
    const endValue = (event.end || {}) as Json;
    const attendees = Array.isArray(event.attendees) ? event.attendees as Json[] : [];
    const conference = (event.conferenceData || {}) as Json;
    const entryPoints = Array.isArray(conference.entryPoints) ? conference.entryPoints as Json[] : [];
    return {
      providerEventId: String(event.id || ""),
      etag: event.etag ? String(event.etag) : null,
      title: String(event.summary || "Untitled event"),
      startsAt: String(start.dateTime || `${start.date || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      endsAt: String(endValue.dateTime || `${endValue.date || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      timezone: String(start.timeZone || "UTC"),
      location: String(event.location || ""),
      notes: cleanHtml(String(event.description || "")),
      attendeeEmails: attendees.map((attendee) => String(attendee.email || "").toLowerCase()).filter(Boolean),
      conferenceUrl: entryPoints.find((point) => point.entryPointType === "video")?.uri ? String(entryPoints.find((point) => point.entryPointType === "video")?.uri) : null,
      providerUpdatedAt: event.updated ? String(event.updated) : null,
      deleted: event.status === "cancelled",
    };
  }).filter((event) => event.providerEventId);
}

async function listMicrosoftEvents(accessToken: string, since: Date): Promise<SyncedCalendarEvent[]> {
  const end = new Date(Date.now() + 366 * 86_400_000);
  const select = "id,subject,bodyPreview,start,end,location,attendees,onlineMeeting,webLink,lastModifiedDateTime,isCancelled";
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(since.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$top=100&$orderby=start/dateTime&$select=${select}`;
  const payload = await providerFetch(url, accessToken);
  const events = Array.isArray(payload.value) ? payload.value as Json[] : [];
  const asUtc = (value: unknown) => {
    const raw = String(value || "");
    return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`).toISOString();
  };
  return events.map((event) => {
    const start = (event.start || {}) as Json;
    const endValue = (event.end || {}) as Json;
    const attendees = Array.isArray(event.attendees) ? event.attendees as Json[] : [];
    const meeting = (event.onlineMeeting || {}) as Json;
    const location = (event.location || {}) as Json;
    return {
      providerEventId: String(event.id || ""),
      etag: null,
      title: String(event.subject || "Untitled event"),
      startsAt: asUtc(start.dateTime),
      endsAt: asUtc(endValue.dateTime),
      timezone: String(start.timeZone || "UTC"),
      location: String(location.displayName || ""),
      notes: String(event.bodyPreview || ""),
      attendeeEmails: attendees.map((attendee) => String((((attendee.emailAddress || {}) as Json).address) || "").toLowerCase()).filter(Boolean),
      conferenceUrl: meeting.joinUrl ? String(meeting.joinUrl) : event.webLink ? String(event.webLink) : null,
      providerUpdatedAt: event.lastModifiedDateTime ? String(event.lastModifiedDateTime) : null,
      deleted: Boolean(event.isCancelled),
    };
  }).filter((event) => event.providerEventId);
}

export function listProviderCalendarEvents(input: { provider: EngagementProvider; accessToken: string; since: Date }) {
  return input.provider === "google"
    ? listGoogleEvents(input.accessToken, input.since)
    : listMicrosoftEvents(input.accessToken, input.since);
}
