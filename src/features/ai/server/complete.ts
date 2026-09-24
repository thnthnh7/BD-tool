import { acquireHold, admit, releaseHold } from "@/lib/admission";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { decryptSecret } from "@/lib/crypto-utils";
import { canUsePaidFeatures } from "@/lib/entitlements";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { incrementUsage } from "@/lib/usage";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteResult = {
  content: string;
  source: "byok" | "platform";
  model: string;
  raw: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function collectTextParts(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((part) => collectTextParts(part)).join("");
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.text === "string") return row.text;
    if (typeof row.content === "string") return row.content;
    if (Array.isArray(row.content)) return collectTextParts(row.content);
  }
  return "";
}

export function extractMessageContent(payload: unknown): string {
  const response = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = first.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : {};
  const candidates = [
    message.content,
    message.text,
    first.text,
    first.content,
    response.output_text,
    response.content,
    response.result,
    message.reasoning_content,
  ];
  return candidates.map((item) => collectTextParts(item).trim()).find(Boolean) || "";
}

export async function callOpenAiCompatible(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" } | { type: "text" };
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 45_000);
  const started = Date.now();
  const baseUrl = params.baseUrl.replace(/\/$/, "");
  try {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? 2_000,
      stream: false,
    };
    if (params.responseFormat?.type === "json_object") {
      body.response_format = { type: "json_object" };
    }
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await upstream.text();
    return { ok: upstream.ok, status: upstream.status, raw, elapsedMs: Date.now() - started, aborted: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      status: 0,
      raw: message,
      elapsedMs: Date.now() - started,
      aborted: message.toLowerCase().includes("abort"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveWorkspaceAiProvider(workspaceId: string, byokEnabled: boolean) {
  if (!byokEnabled) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_ai_providers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  try {
    return { ...data, apiKey: decryptSecret(data.encrypted_api_key) };
  } catch {
    return null;
  }
}

export async function completeChat(input: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" } | { type: "text" };
  timeoutMs?: number;
  consumePlatformQuota?: boolean;
}): Promise<{ data: CompleteResult } | { error: string; status?: number }> {
  const context = await requireWorkspace();
  if (!canUsePaidFeatures(context.planStatus) || context.locked) {
    return { error: "Gói đã hết hạn.", status: 403 };
  }

  const supabase = await createClient();
  const held = await acquireHold(supabase, context.workspaceId, "ai_brief", 70);
  if ("error" in held) return { error: held.error, status: held.status ?? 503 };
  const gate = await admit(supabase, context.workspaceId, "ai_brief", 6, 60);
  if ("error" in gate) {
    await releaseHold(supabase, context.workspaceId, "ai_brief");
    return { error: gate.error, status: gate.status ?? 503 };
  }

  try {
    return await completeChatUnlocked(supabase, context, input);
  } finally {
    await releaseHold(supabase, context.workspaceId, "ai_brief");
  }
}

async function completeChatUnlocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  context: Awaited<ReturnType<typeof requireWorkspace>>,
  input: {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" } | { type: "text" };
    timeoutMs?: number;
    consumePlatformQuota?: boolean;
  },
): Promise<{ data: CompleteResult } | { error: string; status?: number }> {
  const byok = await resolveWorkspaceAiProvider(context.workspaceId, context.plan.features.byok_ai);
  if (byok?.apiKey) {
    const result = await callOpenAiCompatible({
      baseUrl: byok.base_url,
      apiKey: byok.apiKey,
      model: byok.model,
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      responseFormat: input.responseFormat,
      timeoutMs: input.timeoutMs,
    });
    if (result.ok) {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(result.raw) as unknown;
      } catch {
        parsed = {};
      }
      const content = extractMessageContent(parsed) || result.raw;
      const usage =
        parsed && typeof parsed === "object" && "usage" in parsed
          ? ((parsed as { usage?: CompleteResult["usage"] }).usage)
          : undefined;
      console.info("ai.complete", { source: "byok", provider: byok.provider, model: byok.model, usage });
      return { data: { content, source: "byok", model: byok.model, raw: result.raw, usage } };
    }
    console.warn("ai.complete byok failed, falling back", result.raw.slice(0, 120));
  }

  if (!(await isPlatformFlagEnabled("ai_enabled"))) {
    return { error: "AI nền tảng đang tạm dừng.", status: 503 };
  }

  if (input.consumePlatformQuota !== false) {
    const quota = await incrementUsage(
      supabase,
      context.workspaceId,
      "ai_briefs",
      1,
      context.plan.quotas.ai_briefs_per_month,
    );
    if (quota.error) return { error: quota.error, status: 429 };
  }

  const baseUrl = process.env.NINE_ROUTER_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.NINE_ROUTER_API_KEY;
  const model = process.env.NINE_ROUTER_MODEL;
  if (!baseUrl || !apiKey || !model) {
    return { error: "Server chưa cấu hình 9Router.", status: 503 };
  }

  const result = await callOpenAiCompatible({
    baseUrl,
    apiKey,
    model,
    messages: input.messages,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    responseFormat: input.responseFormat,
    timeoutMs: input.timeoutMs,
  });
  if (!result.ok) return { error: `9Router lỗi: ${result.raw.slice(0, 180)}`, status: 502 };
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(result.raw) as unknown;
  } catch {
    parsed = {};
  }
  const content = extractMessageContent(parsed) || result.raw;
  console.info("ai.complete", { source: "platform", model, elapsedMs: result.elapsedMs });
  return { data: { content, source: "platform", model, raw: result.raw } };
}
