"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto-utils";
import { formText } from "@/lib/crm";
import { callOpenAiCompatible } from "@/features/ai/server/complete";
import { withWorkspace } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPPORTED_PROVIDERS = new Set(["openai", "openrouter", "groq", "custom"]);

export async function getDefaultAiProvider() {
  const { context, supabase } = await withWorkspace();
  const period = new Date().toISOString().slice(0, 7);
  const [{ data }, { data: usage }] = await Promise.all([
    createAdminClient()
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
  ]);
  return {
    provider: data,
    canByok: context.plan.features.byok_ai,
    role: context.memberRole,
    platformConfigured: Boolean(process.env.NINE_ROUTER_BASE_URL && process.env.NINE_ROUTER_API_KEY && process.env.NINE_ROUTER_MODEL),
    usage: Number(usage?.ai_briefs || 0),
    quota: context.plan.quotas.ai_briefs_per_month,
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
  if (!baseUrl || !model || !apiKey) return { error: "Cần base URL, model và API key." };
  if (!SUPPORTED_PROVIDERS.has(provider)) return { error: "Nhà cung cấp AI không được hỗ trợ." };

  const test = await callOpenAiCompatible({
    baseUrl,
    apiKey,
    model,
    messages: [{ role: "user", content: "Reply with OK" }],
    maxTokens: 8,
    timeoutMs: 15_000,
  });
  if (!test.ok) return { error: `Không kết nối được provider: ${test.raw.slice(0, 180)}` };

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

export async function deleteAiProviderAction() {
  const context = await requireOwnerOrAdmin();
  const { error } = await createAdminClient().from("workspace_ai_providers").delete().eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}
