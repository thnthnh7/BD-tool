import assert from "node:assert/strict";
import test from "node:test";
import { providerAccessStatus } from "@/lib/billing/subscription-state";

test("provider trials remain trialing instead of being flattened to active", () => {
  assert.equal(providerAccessStatus("trialing", "2099-01-01T00:00:00.000Z"), "trialing");
});

test("a canceled subscription keeps access until its paid period ends", () => {
  assert.equal(providerAccessStatus("CANCELLED", "2099-01-01T00:00:00.000Z"), "active");
  assert.equal(providerAccessStatus("canceled", "2020-01-01T00:00:00.000Z"), "canceled");
});

test("failed and suspended provider states map to restricted local states", () => {
  assert.equal(providerAccessStatus("PAYMENT_FAILED"), "past_due");
  assert.equal(providerAccessStatus("SUSPENDED"), "suspended");
});
