import "server-only";

import { getCrmProviderCredentials } from "@/features/crm-integrations/server/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type OAuthDefinition = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorize?: Record<string, string>;
  clientAuth?: "body" | "basic";
  revokeUrl?: string;
};

const staticOAuth: Record<string, OAuthDefinition> = {
  hubspot: { authorizationUrl: "https://app.hubspot.com/oauth/authorize", tokenUrl: "https://api.hubapi.com/oauth/v3/token", revokeUrl: "https://api.hubapi.com/oauth/2026-03/token/revoke", scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.companies.read", "crm.objects.companies.write", "crm.objects.deals.read", "crm.objects.deals.write"] },
  salesforce: { authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize", tokenUrl: "https://login.salesforce.com/services/oauth2/token", revokeUrl: "https://login.salesforce.com/services/oauth2/revoke", scopes: ["api", "refresh_token"] },
  zoho: { authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth", tokenUrl: "https://accounts.zoho.com/oauth/v2/token", scopes: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.fields.READ", "ZohoCRM.users.READ"], extraAuthorize: { access_type: "offline", prompt: "consent" } },
  pipedrive: { authorizationUrl: "https://oauth.pipedrive.com/oauth/authorize", tokenUrl: "https://oauth.pipedrive.com/oauth/token", scopes: [], clientAuth: "basic" },
  monday: { authorizationUrl: "https://auth.monday.com/oauth2/authorize", tokenUrl: "https://auth.monday.com/oauth2/token", scopes: [] },
  close: { authorizationUrl: "https://app.close.com/oauth2/authorize/", tokenUrl: "https://api.close.com/oauth2/token/", revokeUrl: "https://api.close.com/oauth2/revoke/", scopes: ["all.full_access", "offline_access"] },
};

function origin(value: string) {
  try { return new URL(value).origin; } catch { return ""; }
}

export function crmOAuthDefinition(provider: string, accountLabel = ""): OAuthDefinition | null {
  if (staticOAuth[provider]) return staticOAuth[provider];
  const base = origin(accountLabel);
  if (!base) return null;
  if (provider === "dynamics_365") return { authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scopes: ["offline_access", `${base}/user_impersonation`] };
  if (provider === "freshsales") return { authorizationUrl: `${base}/org/oauth/v2/authorize`, tokenUrl: `${base}/org/oauth/v2/token`, scopes: ["crm:contacts:read", "crm:contacts:write", "crm:accounts:read", "crm:deals:read"] };
  if (provider === "bitrix24") return { authorizationUrl: `${base}/oauth/authorize/`, tokenUrl: `${base}/oauth/token/`, scopes: ["crm"] };
  return null;
}

export async function exchangeCrmAuthorizationCode(input: { provider: string; accountLabel: string; code: string; redirectUri: string; tokenUrlOverride?: string }) {
  const definition = crmOAuthDefinition(input.provider, input.accountLabel);
  const credentials = await getCrmProviderCredentials(input.provider);
  if (!definition || !credentials) throw new Error("CRM OAuth is not configured.");
  const tokenUrl = input.tokenUrlOverride || definition.tokenUrl;
  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (definition.clientAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
  else { body.set("client_id", credentials.clientId); body.set("client_secret", credentials.clientSecret); }
  const response = await fetch(tokenUrl, { method: "POST", headers, body, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") throw new Error(String(payload.error_description || payload.error || `Token exchange failed (${response.status})`));
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : undefined,
    scope: Array.isArray(payload.scopes) ? payload.scopes.map(String) : String(payload.scope || "").split(/[ ,]+/).filter(Boolean),
    tokenUrl: typeof payload.accounts_server === "string" ? `${payload.accounts_server}/oauth/v2/token` : tokenUrl,
    metadata: { api_domain: payload.api_domain, instance_url: payload.instance_url, token_type: payload.token_type },
  };
}

export async function storeCrmTokens(input: { connectionId: string; userId?: string; accessToken: string; refreshToken?: string; expiresIn?: number; scopes?: string[]; metadata?: Record<string, unknown> }) {
  const expiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null;
  const { error } = await createAdminClient().rpc("store_crm_connection_tokens", {
    p_connection_id: input.connectionId,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken || null,
    p_expires_at: expiresAt,
    p_scopes: input.scopes || [],
    p_actor_user_id: input.userId || null,
    p_detail: (input.metadata || {}) as Json,
  });
  if (error) throw new Error(error.message);
}

export async function getCrmConnectionAccessToken(connectionId: string) {
  const admin = createAdminClient();
  const [{ data: connection }, { data: tokens, error }] = await Promise.all([
    admin.from("crm_connections").select("provider, account_label, metadata, status").eq("id", connectionId).single(),
    admin.rpc("get_crm_connection_tokens", { p_connection_id: connectionId }),
  ]);
  const stored = tokens?.[0];
  if (error || !connection || !stored?.access_token || connection.status !== "connected") throw new Error("CRM connection is not authorized.");
  const expiresSoon = stored.token_expires_at && new Date(stored.token_expires_at).getTime() <= Date.now() + 60_000;
  if (!expiresSoon) return stored.access_token;
  if (!stored.refresh_token) throw new Error("CRM authorization expired. Reconnect the CRM.");
  const definition = crmOAuthDefinition(connection.provider, connection.account_label);
  const credentials = await getCrmProviderCredentials(connection.provider);
  if (!definition || !credentials) throw new Error("CRM OAuth is not configured.");
  const metadata = connection.metadata && typeof connection.metadata === "object" && !Array.isArray(connection.metadata) ? connection.metadata as Record<string, unknown> : {};
  const tokenUrl = typeof metadata.token_url === "string" ? metadata.token_url : definition.tokenUrl;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.refresh_token });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (definition.clientAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
  else { body.set("client_id", credentials.clientId); body.set("client_secret", credentials.clientSecret); }
  const response = await fetch(tokenUrl, { method: "POST", headers, body, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    await admin.from("crm_connections").update({ status: "error", last_error: String(payload.error_description || payload.error || "Token refresh failed") }).eq("id", connectionId);
    throw new Error("CRM authorization expired. Reconnect the CRM.");
  }
  await storeCrmTokens({ connectionId, accessToken: payload.access_token, refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : stored.refresh_token, expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : undefined, metadata: { event: "token_refreshed", token_url: tokenUrl } });
  return payload.access_token;
}

export async function revokeCrmProviderTokens(connectionId: string) {
  const admin = createAdminClient();
  const [{ data: connection }, { data: tokens }] = await Promise.all([
    admin.from("crm_connections").select("provider, account_label").eq("id", connectionId).single(),
    admin.rpc("get_crm_connection_tokens", { p_connection_id: connectionId }),
  ]);
  const definition = connection ? crmOAuthDefinition(connection.provider, connection.account_label) : null;
  const token = tokens?.[0]?.refresh_token || tokens?.[0]?.access_token;
  if (!connection || !definition?.revokeUrl || !token) return false;
  const credentials = await getCrmProviderCredentials(connection.provider);
  if (!credentials) return false;
  const body = new URLSearchParams({ token, client_id: credentials.clientId, client_secret: credentials.clientSecret });
  try {
    const response = await fetch(definition.revokeUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return response.ok;
  } catch {
    return false;
  }
}
