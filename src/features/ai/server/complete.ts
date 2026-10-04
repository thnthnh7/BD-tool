import { acquireHold, admit, releaseHold } from "@/lib/admission";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { decryptSecret } from "@/lib/crypto-utils";
import { canUsePaidFeatures } from "@/lib/entitlements";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { incrementUsage } from "@/lib/usage";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteResult = {
  content: string;
  source: "byok" | "platform";
  model: string;
  raw: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type AiUsage = CompleteResult["usage"];

async function recordAiUsage(input: {
  workspaceId: string;
  actorUserId: string;
  operation: string;
  source: "byok" | "platform";
  provider: string;
  model: string;
  status: "success" | "error";
  latencyMs: number;
  usage?: AiUsage;
  error?: string;
}) {
  const { error } = await createAdminClient().from("ai_usage_events").insert({
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId,
    operation: input.operation,
    source: input.source,
    provider: input.provider,
    model: input.model,
    status: input.status,
    latency_ms: input.latencyMs,
    prompt_tokens: input.usage?.prompt_tokens ?? null,
    completion_tokens: input.usage?.completion_tokens ?? null,
    total_tokens: input.usage?.total_tokens ?? null,
    error_message: input.error?.slice(0, 500) || "",
  });
  if (error) console.warn("ai.usage log failed", error.message);
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function validateAiBaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("AI provider URL must use HTTPS without credentials or a custom port.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Private network AI provider URLs are not allowed.");
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("AI provider hostname must resolve only to public IP addresses.");
  }
  return url.origin + url.pathname.replace(/\/$/, "");
}

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
  try {
    const baseUrl = await validateAiBaseUrl(params.baseUrl);
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
      const raw = await upstream.text();
      const retryable = upstream.status === 429 || upstream.status >= 500;
      if (retryable && attempt === 0) {
        const retryAfter = Number(upstream.headers.get("retry-after") || 0) * 1_000;
        await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter, 250), 1_000)));
        continue;
      }
      return { ok: upstream.ok, status: upstream.status, raw, elapsedMs: Date.now() - started, aborted: false };
    }
    return { ok: false, status: 502, raw: "AI provider retry failed.", elapsedMs: Date.now() - started, aborted: false };
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
  const { data } = await createAdminClient()
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
  operation?: "brief" | "deal_analysis" | "completion";
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
    operation?: "brief" | "deal_analysis" | "completion";
  },
): Promise<{ data: CompleteResult } | { error: string; status?: number }> {
  const byok = await resolveWorkspaceAiProvider(context.workspaceId, context.plan.features.byok_ai);
  const operation = input.operation || "completion";
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
      await recordAiUsage({ workspaceId: context.workspaceId, actorUserId: context.userId, operation, source: "byok", provider: byok.provider, model: byok.model, status: "success", latencyMs: result.elapsedMs, usage });
      return { data: { content, source: "byok", model: byok.model, raw: result.raw, usage } };
    }
    await recordAiUsage({ workspaceId: context.workspaceId, actorUserId: context.userId, operation, source: "byok", provider: byok.provider, model: byok.model, status: "error", latencyMs: result.elapsedMs, error: result.raw });
    await createAdminClient()
      .from("workspace_ai_providers")
      .update({ status: "invalid", last_tested_at: new Date().toISOString() })
      .eq("id", byok.id)
      .eq("workspace_id", context.workspaceId);
    console.warn("ai.complete byok failed, falling back", result.raw.slice(0, 120));
  }

  if (!(await isPlatformFlagEnabled("ai_enabled"))) {
    return { error: "AI nền tảng đang tạm dừng.", status: 503 };
  }

  const baseUrl = process.env.NINE_ROUTER_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.NINE_ROUTER_API_KEY;
  const model = process.env.NINE_ROUTER_MODEL;
  if (!baseUrl || !apiKey || !model) {
    await recordAiUsage({ workspaceId: context.workspaceId, actorUserId: context.userId, operation, source: "platform", provider: "platform", model: model || "", status: "error", latencyMs: 0, error: "Platform AI is not configured." });
    return { error: "AI nền tảng chưa được cấu hình.", status: 503 };
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
  if (!result.ok) {
    await recordAiUsage({ workspaceId: context.workspaceId, actorUserId: context.userId, operation, source: "platform", provider: "platform", model, status: "error", latencyMs: result.elapsedMs, error: result.raw });
    return { error: `Nhà cung cấp AI lỗi: ${result.raw.slice(0, 180)}`, status: 502 };
  }
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(result.raw) as unknown;
  } catch {
    parsed = {};
  }
  const content = extractMessageContent(parsed) || result.raw;
  const usage = parsed && typeof parsed === "object" && "usage" in parsed ? (parsed as { usage?: AiUsage }).usage : undefined;
  await recordAiUsage({ workspaceId: context.workspaceId, actorUserId: context.userId, operation, source: "platform", provider: "platform", model, status: "success", latencyMs: result.elapsedMs, usage });
  console.info("ai.complete", { source: "platform", model, elapsedMs: result.elapsedMs, usage });
  return { data: { content, source: "platform", model, raw: result.raw, usage } };
}
