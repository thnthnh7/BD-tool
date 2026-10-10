import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderUsd, providerFetch, ProviderRequestError } from "../runtime";

test("retries safe provider reads and honors a successful response", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 3 ? new Response("busy", { status: 503 }) : new Response("ok", { status: 200 });
  };
  try {
    const response = await providerFetch({ provider: "apify", operation: "read", url: "https://provider.test", baseDelayMs: 0 });
    assert.equal(await response.text(), "ok");
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});

test("never retries a paid POST unless the caller marks it idempotent", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("busy", { status: 503 }); };
  try {
    await assert.rejects(
      providerFetch({ provider: "apify", operation: "start", url: "https://provider.test", init: { method: "POST" }, retryMode: "never", baseDelayMs: 0 }),
      (error: unknown) => error instanceof ProviderRequestError && error.status === 503 && error.retryable,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("normalizes provider costs without accepting negative or invalid values", () => {
  assert.equal(normalizeProviderUsd("0.12345678"), 0.123457);
  assert.equal(normalizeProviderUsd(-1), null);
  assert.equal(normalizeProviderUsd("unknown"), null);
});

