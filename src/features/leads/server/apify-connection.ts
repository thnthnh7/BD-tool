import { revalidatePath } from "next/cache";
import { decryptSecret, encryptSecret } from "@/lib/crypto-utils";
import { requireOwnerOrAdmin, requireWorkspace } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formText } from "@/lib/crm";

type ApifyUser = {
  id?: string;
  username?: string;
  email?: string;
  profile?: { name?: string; pictureUrl?: string };
  plan?: { id?: string };
};

type ApifyLimits = {
  monthlyUsageCycle?: { startAt?: string; endAt?: string };
  limits?: { maxActorMemoryGbytes?: number; maxMonthlyUsageUsd?: number };
  current?: { actorMemoryGbytes?: number; monthlyUsageUsd?: number };
};

function oauthConfig() {
  const clientId = process.env.APIFY_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.APIFY_OAUTH_CLIENT_SECRET || "";
  const authorizationUrl = process.env.APIFY_OAUTH_AUTHORIZATION_URL || "";
  const tokenUrl = process.env.APIFY_OAUTH_TOKEN_URL || "";
  return { clientId, clientSecret, authorizationUrl, tokenUrl, ready: Boolean(clientId && clientSecret && authorizationUrl && tokenUrl) };
}

export async function apifyOauthReady() {
  return oauthConfig().ready;
}

async function apifyGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.apify.com/v2${path}`, {
    headers: { Authorization: `Bearer ${token}`, "x-apify-integration-platform": "leadely" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Apify ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json() as { data?: T };
  if (!payload.data) throw new Error("Apify không trả về dữ liệu.");
  return payload.data;
}

export async function exchangeApifyCode(code: string, redirectUri: string) {
  const config = oauthConfig();
  if (!config.ready) throw new Error("OAuth Apify chưa được cấu hình.");
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || `OAuth Apify thất bại (${response.status}).`);
  return payload;
}

async function refreshAccessToken(connectionId: string, refreshToken: string) {
  const config = oauthConfig();
  if (!config.ready) throw new Error("OAuth Apify chưa được cấu hình.");
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  const admin = createAdminClient();
  if (!response.ok || !payload.access_token) {
    await admin.from("apify_connections").update({ status: "expired", last_error: payload.error_description || "Không refresh được OAuth token." }).eq("id", connectionId);
    throw new Error("Kết nối Apify đã hết hạn. Hãy kết nối lại.");
  }
  await admin.from("apify_connections").update({
    encrypted_access_token: encryptSecret(payload.access_token),
    encrypted_refresh_token: payload.refresh_token ? encryptSecret(payload.refresh_token) : encryptSecret(refreshToken),
    token_expires_at: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : null,
    status: "active",
    last_error: null,
  }).eq("id", connectionId);
  return payload.access_token;
}

export async function getApifyConnectionToken(connectionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("apify_connections").select("*").eq("id", connectionId).maybeSingle();
  if (!data || data.status === "revoked") throw new Error("Kết nối Apify không còn khả dụng.");
  const expiresSoon = data.token_expires_at && new Date(data.token_expires_at).getTime() <= Date.now() + 60_000;
  if (expiresSoon) {
    if (!data.encrypted_refresh_token) throw new Error("Kết nối Apify đã hết hạn. Hãy kết nối lại.");
    return refreshAccessToken(data.id, decryptSecret(data.encrypted_refresh_token));
  }
  return decryptSecret(data.encrypted_access_token);
}

export async function getWorkspaceApifyConnection(workspaceId: string) {
  const admin = createAdminClient();
  const { data: link } = await admin.from("workspace_apify_connections").select("apify_connection_id").eq("workspace_id", workspaceId).maybeSingle();
  if (!link) return null;
  const { data: connection } = await admin.from("apify_connections").select("*").eq("id", link.apify_connection_id).maybeSingle();
  return connection || null;
}

export async function requireWorkspaceApifyConnection(workspaceId: string) {
  const connection = await getWorkspaceApifyConnection(workspaceId);
  if (!connection) throw new Error("Workspace chưa kết nối tài khoản Apify.");
  if (connection.status !== "active") throw new Error("Kết nối Apify cần được xác thực lại.");
  const token = await getApifyConnectionToken(connection.id);
  return { connection, token };
}

export async function syncApifyConnection(connectionId: string, token?: string) {
  const accessToken = token || await getApifyConnectionToken(connectionId);
  const [user, limits] = await Promise.all([apifyGet<ApifyUser>("/users/me", accessToken), apifyGet<ApifyLimits>("/users/me/limits", accessToken)]);
  if (!user.id) throw new Error("Không xác định được tài khoản Apify.");
  const snapshot = {
    apify_user_id: user.id,
    apify_username: user.username || user.profile?.name || "Apify",
    apify_email: user.email || "",
    apify_avatar_url: user.profile?.pictureUrl || null,
    apify_plan_id: user.plan?.id || null,
    current_memory_gbytes: limits.current?.actorMemoryGbytes ?? null,
    max_memory_gbytes: limits.limits?.maxActorMemoryGbytes ?? null,
    monthly_usage_usd: limits.current?.monthlyUsageUsd ?? null,
    max_monthly_usage_usd: limits.limits?.maxMonthlyUsageUsd ?? null,
    usage_cycle_start: limits.monthlyUsageCycle?.startAt || null,
    usage_cycle_end: limits.monthlyUsageCycle?.endAt || null,
    last_synced_at: new Date().toISOString(),
    last_error: null,
    status: "active",
  };
  const admin = createAdminClient();
  const { error } = await admin.from("apify_connections").update(snapshot).eq("id", connectionId);
  if (error) throw new Error(error.message);
  return snapshot;
}

export async function saveApifyOauthConnection(input: { workspaceId: string; userId: string; accessToken: string; refreshToken?: string; expiresIn?: number }) {
  const user = await apifyGet<ApifyUser>("/users/me", input.accessToken);
  if (!user.id) throw new Error("Không xác định được tài khoản Apify.");
  const admin = createAdminClient();
  const { data: connection, error } = await admin.from("apify_connections").upsert({
    owner_user_id: input.userId,
    apify_user_id: user.id,
    apify_username: user.username || user.profile?.name || "Apify",
    apify_email: user.email || "",
    apify_avatar_url: user.profile?.pictureUrl || null,
    apify_plan_id: user.plan?.id || null,
    encrypted_access_token: encryptSecret(input.accessToken),
    encrypted_refresh_token: input.refreshToken ? encryptSecret(input.refreshToken) : null,
    token_expires_at: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    status: "active",
    auth_method: "oauth",
    token_last_four: null,
    token_label: null,
    last_error: null,
  }, { onConflict: "owner_user_id,apify_user_id" }).select("id").single();
  if (error || !connection) throw new Error(error?.message || "Không lưu được kết nối Apify.");
  const { error: linkError } = await admin.from("workspace_apify_connections").upsert({ workspace_id: input.workspaceId, apify_connection_id: connection.id, connected_by: input.userId }, { onConflict: "workspace_id" });
  if (linkError) throw new Error(linkError.message);
  await syncApifyConnection(connection.id, input.accessToken);
  return connection.id;
}

export async function saveApifyTokenAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const token = formText(formData, "api_token");
  const label = formText(formData, "token_label") || "Bizcraw";
  if (token.length < 20) return { error: "API token không hợp lệ." };
  try {
    const [user, limits] = await Promise.all([apifyGet<ApifyUser>("/users/me", token), apifyGet<ApifyLimits>("/users/me/limits", token)]);
    if (!user.id) return { error: "Không xác định được tài khoản Apify." };
    const admin = createAdminClient();
    const { data: connection, error } = await admin.from("apify_connections").upsert({
      owner_user_id: context.userId,
      apify_user_id: user.id,
      apify_username: user.username || user.profile?.name || "Apify",
      apify_email: user.email || "",
      apify_avatar_url: user.profile?.pictureUrl || null,
      apify_plan_id: user.plan?.id || null,
      encrypted_access_token: encryptSecret(token),
      encrypted_refresh_token: null,
      token_expires_at: null,
      auth_method: "api_token",
      token_last_four: token.slice(-4),
      token_label: label.slice(0, 80),
      status: "active",
      current_memory_gbytes: limits.current?.actorMemoryGbytes ?? null,
      max_memory_gbytes: limits.limits?.maxActorMemoryGbytes ?? null,
      monthly_usage_usd: limits.current?.monthlyUsageUsd ?? null,
      max_monthly_usage_usd: limits.limits?.maxMonthlyUsageUsd ?? null,
      usage_cycle_start: limits.monthlyUsageCycle?.startAt || null,
      usage_cycle_end: limits.monthlyUsageCycle?.endAt || null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "owner_user_id,apify_user_id" }).select("id").single();
    if (error || !connection) return { error: error?.message || "Không lưu được kết nối Apify." };
    const { error: linkError } = await admin.from("workspace_apify_connections").upsert({ workspace_id: context.workspaceId, apify_connection_id: connection.id, connected_by: context.userId }, { onConflict: "workspace_id" });
    if (linkError) return { error: linkError.message };
    revalidateApifyPages();
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? `Không kết nối được Apify: ${error.message}` : "Không kết nối được Apify." };
  }
}

export async function getCurrentWorkspaceApifyStatus() {
  const context = await requireWorkspace();
  const connection = await getWorkspaceApifyConnection(context.workspaceId);
  return { connection, oauthReady: await apifyOauthReady(), canManage: context.memberRole !== "member", workspaceId: context.workspaceId };
}

export async function refreshApifyConnectionAction(_formData: FormData) {
  void _formData;
  const context = await requireOwnerOrAdmin();
  const connection = await getWorkspaceApifyConnection(context.workspaceId);
  if (!connection) return { error: "Workspace chưa kết nối Apify." };
  try {
    await syncApifyConnection(connection.id);
    revalidateApifyPages();
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Không cập nhật được Apify." };
  }
}

export async function unlinkApifyConnectionAction(_formData: FormData) {
  void _formData;
  const context = await requireOwnerOrAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("workspace_apify_connections").delete().eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidateApifyPages();
  return { ok: true as const };
}

function revalidateApifyPages() {
  revalidatePath("/app/settings");
  revalidatePath("/app/leads/sources");
  revalidatePath("/app/leads/scrape");
  revalidatePath("/app/leads/scrape/new");
}
