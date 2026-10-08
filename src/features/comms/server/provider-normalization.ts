export type SyncedMessage = {
  providerMessageId: string;
  threadId: string | null;
  internetMessageId: string | null;
  subject: string;
  body: string;
  snippet: string;
  from: string;
  to: string;
  occurredAt: string;
  direction: "inbound" | "outbound";
};

export type SyncedCalendarEvent = {
  providerEventId: string;
  etag: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  notes: string;
  attendeeEmails: string[];
  conferenceUrl: string | null;
  providerUpdatedAt: string | null;
  deleted: boolean;
};

export function extractEmail(value: string) {
  const bracketed = value.match(/<([^>]+)>/);
  return (bracketed?.[1] || value).trim().toLowerCase();
}

export function decodeBase64Url(value: string) {
  if (!value) return "";
  return Buffer.from(value, "base64url").toString("utf8");
}

export function cleanHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
