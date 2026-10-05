import assert from "node:assert/strict";
import test from "node:test";
import { explainProviderError, filterChatModelIds, orderModels, pickDefaultModel } from "../provider-catalog";

test("chat model filter drops media and embedding models", () => {
  const models = filterChatModelIds([
    "gpt-4.1-mini",
    "whisper-1",
    "text-embedding-3-small",
    "dall-e-3",
    "tts-1",
    "models/gemini-2.5-flash",
  ]);
  assert.deepEqual(models.sort(), ["gemini-2.5-flash", "gpt-4.1-mini"]);
});

test("default model prefers a listed recommended id and keeps a saved model", () => {
  const ordered = orderModels("openai", ["gpt-4o", "gpt-4.1", "gpt-4.1-mini"]);
  assert.equal(ordered[0], "gpt-4.1-mini");
  assert.equal(pickDefaultModel("openai", ordered), "gpt-4.1-mini");
  assert.equal(pickDefaultModel("openai", ordered, "gpt-4o"), "gpt-4o");
});

test("provider errors hide raw JSON and name a missing model", () => {
  const raw = JSON.stringify({ error: { message: "The model 'GPT' does not exist or you do not have access to it.", type: "invalid_request_error" } });
  assert.equal(explainProviderError(raw), "This API key cannot use that model. Choose a model from the list for this key.");
  assert.match(explainProviderError("Incorrect API key provided"), /API key was rejected/);
});
