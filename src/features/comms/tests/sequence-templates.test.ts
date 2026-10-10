import assert from "node:assert/strict";
import test from "node:test";
import { SEQUENCE_TEMPLATES } from "../sequence-templates";
import { validateSequenceStep } from "../sequence-validation";

test("ships unique sequence templates whose steps all pass activation validation", () => {
  assert.equal(new Set(SEQUENCE_TEMPLATES.map((template) => template.id)).size, SEQUENCE_TEMPLATES.length);
  for (const template of SEQUENCE_TEMPLATES) {
    assert.ok(template.steps.length > 1);
    for (const step of template.steps) assert.ok("value" in validateSequenceStep(step), `${template.id} has an invalid step`);
  }
});
