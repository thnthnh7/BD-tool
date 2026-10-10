import assert from "node:assert/strict";
import test from "node:test";
import { importEligibility, withoutEmptyValues } from "../import-policy";

const readyRecord = { record_type: "organization", review_status: "ready", duplicate_of_id: null, quality_score: 80 };

test("allows only reviewed records compatible with the CRM target", () => {
  assert.deepEqual(importEligibility(readyRecord, "company"), { eligible: true, reason: "" });
  assert.deepEqual(importEligibility(readyRecord, "contact"), { eligible: false, reason: "incompatible_record_type" });
  assert.deepEqual(importEligibility({ ...readyRecord, review_status: "suppressed" }, "company"), { eligible: false, reason: "suppressed" });
  assert.deepEqual(importEligibility({ ...readyRecord, duplicate_of_id: "original" }, "company"), { eligible: false, reason: "duplicate_source_record" });
  assert.deepEqual(importEligibility({ ...readyRecord, quality_score: 49 }, "company"), { eligible: false, reason: "quality_below_50" });
});

test("does not erase existing CRM values with empty imported fields", () => {
  assert.deepEqual(withoutEmptyValues({ name: "Acme", email: "", phone: "  " }), { name: "Acme" });
});
