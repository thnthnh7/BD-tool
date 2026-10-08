import "server-only";

import { randomUUID } from "crypto";

export type EngagementProvider = "google" | "microsoft";

type ProviderDefinition = {
  authorizationUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string[];
};

const definitions: Record<EngagementProvider, ProviderDefinition> = {
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  },
  microsoft: {
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    profileUrl: "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    scopes: ["openid", "email", "profile", "offline_access", "User.Read", "Mail.Read", "Mail.Send", "Calendars.ReadWrite"],
  },
};

export function isEngagementProvider(value: string): value is EngagementProvider {
  return value === "google" || value === "microsoft";
}

export function engagementProviderReady(provider: EngagementProvider) {
  const prefix = provider === "google" ? "GOOGLE_ENGAGEMENT" : "MICROSOFT_ENGAGEMENT";
  return Boolean(process.env[`${prefix}_CLIENT_ID`] && process.env[`${prefix}_CLIENT_SECRET`]);
}

function credentials(provider: EngagementProvider) {
  const prefix = provider === "google" ? "GOOGLE_ENGAGEMENT" : "MICROSOFT_ENGAGEMENT";
  const clientId = process.env[`${prefix}_CLIENT_ID`] || "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] || "";
  if (!clientId || !clientSecret) throw new Error(`${provider} engagement OAuth is not configured.`);
  return { clientId, clientSecret };
}

export function engagementAuthorizationUrl(provider: EngagementProvider, redirectUri: string, state: string) {
  const definition = definitions[provider];
  const { clientId } = credentials(provider);
  const url = new URL(definition.authorizationUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", definition.scopes.join(" "));
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  } else {
    url.searchParams.set("prompt", "select_account");
  }
  return url;
}

export async function exchangeEngagementCode(provider: EngagementProvider, code: string, redirectUri: string) {
  const definition = definitions[provider];
  const { clientId, clientSecret } = credentials(provider);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(definition.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(String(payload.error_description || payload.error || `OAuth token exchange failed (${response.status})`));
  }
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
    scopes: String(payload.scope || definitions[provider].scopes.join(" ")).split(/\s+/).filter(Boolean),
  };
}

export async function refreshEngagementToken(provider: EngagementProvider, refreshToken: string) {
  const definition = definitions[provider];
  const { clientId, clientSecret } = credentials(provider);
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch(definition.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(String(payload.error_description || payload.error || "OAuth token refresh failed"));
  }
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : refreshToken,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
    scopes: typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : undefined,
  };
}

export async function getEngagementProfile(provider: EngagementProvider, accessToken: string) {
  const response = await fetch(definitions[provider].profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Cannot read ${provider} account profile.`);
  if (provider === "google") {
    return { id: String(payload.sub || ""), email: String(payload.email || ""), displayName: String(payload.name || "") };
  }
  return {
    id: String(payload.id || ""),
    email: String(payload.mail || payload.userPrincipalName || ""),
    displayName: String(payload.displayName || ""),
  };
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function mailHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function assertEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("A valid recipient email address is required.");
  return normalized;
}

export async function sendProviderEmail(input: {
  provider: EngagementProvider;
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const from = mailHeader(input.from);
  const to = assertEmail(input.to);
  const subject = mailHeader(input.subject);
  if (input.provider === "google") {
    const mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.body,
    ].join("\r\n");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: base64Url(mime) }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String((payload.error as { message?: string } | undefined)?.message || `Gmail send failed (${response.status})`));
    return { messageId: String(payload.id || randomUUID()), threadId: String(payload.threadId || "") };
  }

  const clientRequestId = randomUUID();
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "client-request-id": clientRequestId,
      "return-client-request-id": "true",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `Microsoft send failed (${response.status})`);
  }
  return { messageId: `microsoft:${clientRequestId}`, threadId: "" };
}

export async function createProviderEvent(input: {
  provider: EngagementProvider;
  accessToken: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location?: string;
  notes?: string;
  attendeeEmail?: string;
}) {
  const attendees = input.attendeeEmail ? [{ email: input.attendeeEmail }] : [];
  if (input.provider === "google") {
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.title,
        description: input.notes || "",
        location: input.location || "",
        start: { dateTime: input.startsAt, timeZone: input.timezone },
        end: { dateTime: input.endsAt, timeZone: input.timezone },
        attendees,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String((payload.error as { message?: string } | undefined)?.message || `Google Calendar create failed (${response.status})`));
    return { eventId: String(payload.id || ""), etag: String(payload.etag || ""), htmlLink: String(payload.htmlLink || "") };
  }

  const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: input.title,
      body: { contentType: "Text", content: input.notes || "" },
      start: { dateTime: input.startsAt.replace(/Z$/, ""), timeZone: input.timezone },
      end: { dateTime: input.endsAt.replace(/Z$/, ""), timeZone: input.timezone },
      location: { displayName: input.location || "" },
      attendees: input.attendeeEmail ? [{ emailAddress: { address: input.attendeeEmail }, type: "required" }] : [],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String((payload.error as { message?: string } | undefined)?.message || `Microsoft Calendar create failed (${response.status})`));
  return { eventId: String(payload.id || ""), etag: String(payload["@odata.etag"] || ""), htmlLink: String(payload.webLink || "") };
}
