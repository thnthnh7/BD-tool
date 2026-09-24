"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto-utils";
import { formText } from "@/lib/crm";
import { callOpenAiCompatible } from "@/features/ai/server/complete";
import { withWorkspace } from "@/lib/events";

export async function getDefaultAiProvider() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("workspace_ai_providers")
    .select("id, provider, base_url, model, is_default, status, last_tested_at, created_at")
    .eq("workspace_id", context.workspaceId)
    .eq("is_default", true)
    .maybeSingle();
  return { provider: data, canByok: context.plan.features.byok_ai, role: context.memberRole };
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
  if (!baseUrl || !model || !apiKey) return { error: "Cần base URL, model và API key." };

  const test = await callOpenAiCompatible({
    baseUrl,
    apiKey,
    model,
    messages: [{ role: "user", content: "Reply with OK" }],
    maxTokens: 8,
    timeoutMs: 15_000,
  });
  if (!test.ok) return { error: `Không kết nối được provider: ${test.raw.slice(0, 180)}` };

  await supabase.from("workspace_ai_providers").update({ is_default: false }).eq("workspace_id", context.workspaceId);
  const { error } = await supabase.from("workspace_ai_providers").insert({
    workspace_id: context.workspaceId,
    provider: formText(formData, "provider") || "custom",
    base_url: baseUrl,
    model,
    encrypted_api_key: encryptSecret(apiKey),
    is_default: true,
    status: "active",
    created_by: context.userId,
    last_tested_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function deleteAiProviderAction() {
  const context = await requireOwnerOrAdmin();
  const { supabase } = await withWorkspace();
  await supabase.from("workspace_ai_providers").delete().eq("workspace_id", context.workspaceId);
  revalidatePath("/app/settings");
  return { ok: true as const };
}
