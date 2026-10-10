import assert from "node:assert/strict";
import test from "node:test";
import { validateSequenceStep } from "../sequence-validation";

test("requires deliverable content for email and task steps", () => {
  assert.equal(validateSequenceStep({ stepType: "email", delayDays: 0, delayMinutes: 0, subject: "", body: "Hello" }).error, "Email steps require a subject and body.");
  assert.equal(validateSequenceStep({ stepType: "task", delayDays: 0, delayMinutes: 0, subject: "", body: "Call" }).error, "Task steps require a title.");
  assert.ok("value" in validateSequenceStep({ stepType: "wait", delayDays: 2, delayMinutes: 0, subject: "", body: "" }));
});

test("bounds delays and rejects unknown step types", () => {
  assert.ok("error" in validateSequenceStep({ stepType: "webhook", delayDays: 0, delayMinutes: 0, subject: "x", body: "x" }));
  assert.ok("error" in validateSequenceStep({ stepType: "wait", delayDays: -1, delayMinutes: 0, subject: "", body: "" }));
  assert.ok("error" in validateSequenceStep({ stepType: "wait", delayDays: 0, delayMinutes: 1440, subject: "", body: "" }));
});
