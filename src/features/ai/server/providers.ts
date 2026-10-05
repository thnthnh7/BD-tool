"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto-utils";
import { formText } from "@/lib/crm";
import { callAiProvider, validateAiBaseUrl } from "@/features/ai/server/complete";
import { explainProviderError, fallbackModels, filterChatModelIds, orderModels, pickDefaultModel, type AiProviderName } from "@/features/ai/provider-catalog";
import { withWorkspace } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPPORTED_PROVIDERS = new Set<string>([
  "openai", "anthropic", "google", "deepseek", "mistral", "xai", "openrouter", "groq", "custom",
]);

export async function getDefaultAiProvider() {
  const { context, supabase } = await withWorkspace();
  const period = new Date().toISOString().slice(0, 7);
  const canManage = context.memberRole === "owner" || context.memberRole === "admin";
  const admin = createAdminClient();
  const [{ data }, { data: usage }, { count: readyKnowledge }, { data: events }] = await Promise.all([
    admin
      .from("workspace_ai_providers")
      .select("id, provider, base_url, model, is_default, status, last_tested_at, created_at")
      .eq("workspace_id", context.workspaceId)
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("usage_counters")
      .select("ai_briefs")
      .eq("workspace_id", context.workspaceId)
      .eq("period", period)
      .maybeSingle(),
    admin
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspaceId)
      .eq("status", "ready"),
    canManage
      ? admin
          .from("ai_usage_events")
          .select("actor_user_id, operation, source, provider, model, status, latency_ms, total_tokens, error_message, created_at")
          .eq("workspace_id", context.workspaceId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  const actorIds = [...new Set((events || []).map((event) => event.actor_user_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, display_name, email").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors || []).map((actor) => [actor.id, actor.display_name || actor.email]));
  return {
    provider: data,
    canByok: context.plan.features.byok_ai,
    role: context.memberRole,
    usage: Number(usage?.ai_briefs || 0),
    quota: context.plan.quotas.ai_briefs_per_month,
    readyKnowledge: readyKnowledge || 0,
    recentActivity: (events || []).map((event) => ({ ...event, actor: event.actor_user_id ? actorMap.get(event.actor_user_id) || "Unknown user" : "System" })),
  };
}

export async function saveAiProviderAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  if (!context.plan.features.byok_ai) {
    return { error: "Gói Free không được gắn API key riêng." };
  }
  const { supabase } = await withWorkspace();
  const baseUrl = formText(formData, "base_url").replace(/\/$/, "");
  const model = formText(formData, "model");
  const apiKey = formText(formData, "api_key");
  const provider = formText(formData, "provider") || "custom";
  if (!baseUrl || !apiKey) return { error: "Enter the base URL and API key." };
  if (!model) return { error: "Paste the API key and choose a model from the list." };
  if (!SUPPORTED_PROVIDERS.has(provider)) return { error: "Nhà cung cấp AI không được hỗ trợ." };

  const test = await callAiProvider({
    provider,
    baseUrl,
    apiKey,
    model,
    messages: [{ role: "user", content: "Reply with OK" }],
    maxTokens: 8,
    timeoutMs: 15_000,
  });
  if (!test.ok) return { error: explainProviderError(test.raw) };

  const { error } = await supabase.rpc("replace_workspace_ai_provider", {
    target_workspace_id: context.workspaceId,
    provider_name: provider,
    provider_base_url: baseUrl,
    provider_model: model,
    provider_encrypted_api_key: encryptSecret(apiKey),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function listAiModelsAction(input: { provider: string; baseUrl: string; apiKey: string }) {
  const context = await requireOwnerOrAdmin();
  if (!context.plan.features.byok_ai) return { error: "This plan cannot use its own API key." };
  const provider = input.provider as AiProviderName;
  const apiKey = input.apiKey.trim();
  if (!SUPPORTED_PROVIDERS.has(provider)) return { error: "This AI provider is not supported." };
  if (apiKey.length < 12 || apiKey.length > 500) return { error: "Paste the full API key first." };
  let baseUrl = "";
  try {
    baseUrl = await validateAiBaseUrl(input.baseUrl.trim());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The base URL is not allowed." };
  }
  try {
    const ids = await fetchProviderModelIds(provider, baseUrl, apiKey);
    const models = orderModels(provider, filterChatModelIds(ids));
    if (!models.length) return listedOrFallback(provider, []);
    return { ok: true as const, models, model: pickDefaultModel(provider, models), source: "account" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "rejected") return { error: "The API key was rejected. Check the key in the provider account and paste it again." };
    return listedOrFallback(provider, []);
  }
}

function listedOrFallback(provider: string, models: string[]) {
  const fallback = models.length ? models : fallbackModels(provider);
  if (!fallback.length) return { error: "This provider did not return a model list. Type the model ID from its documentation." };
  return { ok: true as const, models: fallback, model: pickDefaultModel(provider, fallback), source: "fallback" as const };
}

async function fetchProviderModelIds(provider: AiProviderName, baseUrl: string, apiKey: string) {
  const headers: Record<string, string> = provider === "anthropic"
    ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : { Authorization: `Bearer ${apiKey}` };
  const response = await fetch(`${baseUrl}/models`, {
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("redirect");
  if (response.status === 401 || response.status === 403) throw new Error("rejected");
  if (!response.ok) throw new Error("unavailable");
  const payload = await response.json() as { data?: { id?: string; name?: string }[]; models?: { id?: string; name?: string }[] };
  const rows = payload.data || payload.models || [];
  return rows.map((row) => row.id || row.name || "");
}

export async function deleteAiProviderAction() {
  const context = await requireOwnerOrAdmin();
  const { error } = await createAdminClient().from("workspace_ai_providers").delete().eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}
