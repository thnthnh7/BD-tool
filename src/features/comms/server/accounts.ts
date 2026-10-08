import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { refreshEngagementToken, type EngagementProvider } from "@/features/comms/server/providers";

export async function listEngagementAccounts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("engagement_accounts")
    .select("id, provider, account_email, display_name, status, capabilities, granted_scopes, authorized_at, last_synced_at, last_error")
    .order("created_at");
  return data || [];
}

export async function saveEngagementAccount(input: {
  workspaceId: string;
  userId: string;
  provider: EngagementProvider;
  providerAccountId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
}) {
  const admin = createAdminClient();
  const { data: account, error } = await admin.from("engagement_accounts").upsert({
    workspace_id: input.workspaceId,
    owner_user_id: input.userId,
    provider: input.provider,
    provider_account_id: input.providerAccountId,
    account_email: input.email,
    display_name: input.displayName,
    status: "connected",
    capabilities: ["mail", "calendar"],
    last_error: null,
  }, { onConflict: "workspace_id,provider,provider_account_id" }).select("id").single();
  if (error || !account) throw new Error(error?.message || "Cannot save engagement account.");
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  const { error: tokenError } = await admin.rpc("store_engagement_account_tokens", {
    p_account_id: account.id,
    p_access_token: input.accessToken,
    p_refresh_token: input.refreshToken || null,
    p_expires_at: expiresAt,
    p_scopes: input.scopes,
    p_actor_user_id: input.userId,
  });
  if (tokenError) throw new Error(tokenError.message);
  for (const resource of ["mail", "calendar"]) {
    await admin.from("engagement_subscriptions").upsert({
      workspace_id: input.workspaceId,
      account_id: account.id,
      resource,
      status: "pending",
    }, { onConflict: "account_id,resource" });
  }
  return account.id;
}

export async function getEngagementAccessToken(accountId: string) {
  const admin = createAdminClient();
  const [{ data: account }, { data: rows, error }] = await Promise.all([
    admin.from("engagement_accounts").select("provider, status, granted_scopes").eq("id", accountId).single(),
    admin.rpc("get_engagement_account_tokens", { p_account_id: accountId }),
  ]);
  const stored = rows?.[0];
  if (error || !account || !stored?.access_token || account.status !== "connected") throw new Error("Engagement account is not connected.");
  const expiresSoon = stored.token_expires_at && new Date(stored.token_expires_at).getTime() <= Date.now() + 60_000;
  if (!expiresSoon) return stored.access_token;
  if (!stored.refresh_token) throw new Error("Engagement authorization expired. Reconnect the account.");
  try {
    const refreshed = await refreshEngagementToken(account.provider as EngagementProvider, stored.refresh_token);
    const { error: storeError } = await admin.rpc("store_engagement_account_tokens", {
      p_account_id: accountId,
      p_access_token: refreshed.accessToken,
      p_refresh_token: refreshed.refreshToken,
      p_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      p_scopes: refreshed.scopes || account.granted_scopes,
      p_actor_user_id: null,
    });
    if (storeError) throw new Error(storeError.message);
    return refreshed.accessToken;
  } catch (cause) {
    await admin.from("engagement_accounts").update({ status: "error", last_error: cause instanceof Error ? cause.message : "Token refresh failed" }).eq("id", accountId);
    throw cause;
  }
}
