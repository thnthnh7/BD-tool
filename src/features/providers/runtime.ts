import type { DataProviderId } from "./catalog";

type RetryMode = "safe" | "always" | "never";

export class ProviderRequestError extends Error {
  readonly provider: DataProviderId;
  readonly operation: string;
  readonly status: number | null;
  readonly code: "http_error" | "network_error" | "timeout";
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(input: {
    provider: DataProviderId; operation: string; status: number | null;
    code: ProviderRequestError["code"]; retryable: boolean; requestId?: string | null; detail?: string;
  }) {
    const suffix = input.status ? ` (${input.status})` : "";
    super(`${input.provider} ${input.operation} failed${suffix}${input.detail ? `: ${input.detail}` : ""}`);
    this.name = "ProviderRequestError";
    this.provider = input.provider;
    this.operation = input.operation;
    this.status = input.status;
    this.code = input.code;
    this.retryable = input.retryable;
    this.requestId = input.requestId || null;
  }
}

function safeMethod(method?: string) {
  return ["GET", "HEAD", "OPTIONS", "DELETE"].includes((method || "GET").toUpperCase());
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(response: Response | null, attempt: number, baseDelayMs: number) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Math.min(10_000, Number(retryAfter) * 1000);
  return Math.min(5_000, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function providerFetch(input: {
  provider: DataProviderId;
  operation: string;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  retryMode?: RetryMode;
  maxAttempts?: number;
  baseDelayMs?: number;
}) {
  const retryMode = input.retryMode || "safe";
  const mayRetry = retryMode === "always" || (retryMode === "safe" && safeMethod(input.init?.method));
  const maxAttempts = mayRetry ? Math.max(1, input.maxAttempts || 3) : 1;
  const baseDelayMs = Math.max(0, input.baseDelayMs ?? 250);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await fetch(input.url, {
        ...input.init,
        cache: "no-store",
        signal: AbortSignal.timeout(input.timeoutMs || 15_000),
      });
      if (response.ok) return response;
      const retryable = retryableStatus(response.status);
      if (retryable && attempt < maxAttempts) {
        await sleep(retryDelay(response, attempt, baseDelayMs));
        continue;
      }
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError({
        provider: input.provider, operation: input.operation, status: response.status,
        code: "http_error", retryable, requestId: response.headers.get("x-request-id"),
      });
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error;
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (attempt < maxAttempts) {
        await sleep(retryDelay(response, attempt, baseDelayMs));
        continue;
      }
      throw new ProviderRequestError({
        provider: input.provider, operation: input.operation, status: null,
        code: timeout ? "timeout" : "network_error", retryable: true,
      });
    }
  }
  throw new ProviderRequestError({ provider: input.provider, operation: input.operation, status: null, code: "network_error", retryable: true });
}

export function normalizeProviderUsd(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 1_000_000) / 1_000_000 : null;
}

