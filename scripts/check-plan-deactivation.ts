import assert from "node:assert/strict";
import { effectivePlanStatus, restoredPlanStatus } from "../src/lib/billing/plan-access";

assert.equal(effectivePlanStatus("active", null), "active");
assert.equal(effectivePlanStatus("past_due", null), "past_due");
assert.equal(effectivePlanStatus("active", "2026-09-27T00:00:00.000Z"), "canceled");
assert.equal(effectivePlanStatus("expired", "2026-09-27T00:00:00.000Z"), "canceled");

assert.equal(restoredPlanStatus("active", "past_due"), "active");
assert.equal(restoredPlanStatus("past_due", "active"), "past_due");
assert.equal(restoredPlanStatus(null, "trialing"), "trialing");
assert.equal(restoredPlanStatus("pending", "active"), "active");
assert.equal(restoredPlanStatus("pending", null), "expired");

console.log("PASS: admin plan deactivation lock and safe restoration status");
