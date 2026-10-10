import assert from "node:assert/strict";
import test from "node:test";
import { parseSuppressionEmails } from "../suppression";

test("normalizes and deduplicates manually suppressed addresses", () => {
  assert.deepEqual(parseSuppressionEmails(" ADA@Example.com,ada@example.com\nlinh@example.vn"), {
    emails: ["ada@example.com", "linh@example.vn"], invalid: [], tooMany: false,
  });
});

test("reports invalid input and enforces the batch limit", () => {
  const parsed = parseSuppressionEmails("valid@example.com invalid", 1);
  assert.deepEqual(parsed.emails, ["valid@example.com"]);
  assert.deepEqual(parsed.invalid, ["invalid"]);
  assert.equal(parsed.tooMany, true);
});
