import test from "node:test";
import assert from "node:assert/strict";
import { summarizePricing } from "../source-pricing";

test("uses primary event and Free-tier price instead of the cheapest tier or startup fee", () => {
  const summary = summarizePricing({ pricingModel: "PAY_PER_EVENT", pricingPerEvent: { actorChargeEvents: {
    start: { eventPriceUsd: 0.00005, isOneTimeEvent: true },
    place: { eventTitle: "Place", isPrimaryEvent: true, eventTieredPricingUsd: { FREE: { tieredEventPriceUsd: 0.004 }, GOLD: { tieredEventPriceUsd: 0.0015 } } },
  } } });
  assert.equal(summary?.amount, "$4.00");
  assert.equal(summary?.unit, "1.000 Place");
  assert.equal(summary?.events.length, 2);
});
test("does not invent missing pricing, retains zero, and does not multiply one-time charges", () => {
  assert.equal(summarizePricing({ pricingModel: "FREE" }), null);
  assert.equal(summarizePricing({ pricingModel: "PAY_PER_EVENT" }), null);
  assert.equal(summarizePricing({ pricingModel: "PAY_PER_EVENT", pricingPerEvent: { actorChargeEvents: { start: { eventPriceUsd: 2, isOneTimeEvent: true } } } })?.amount, "$2.00");
  assert.equal(summarizePricing({ pricingModel: "PAY_PER_EVENT", pricingPerEvent: { actorChargeEvents: { result: { eventPriceUsd: 0 } } } })?.amount, "$0.00");
});
