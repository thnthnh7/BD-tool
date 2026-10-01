import assert from "node:assert/strict";

import { applyImportMappings, resolveImportConflict, transformCrmValue } from "../src/features/crm-integrations/server/sync-logic";

assert.equal(transformCrmValue("  TEST@EXAMPLE.COM ", "trim"), "TEST@EXAMPLE.COM");
assert.equal(transformCrmValue("TEST@EXAMPLE.COM", "lowercase"), "test@example.com");
assert.equal(transformCrmValue("42.5", "number"), 42.5);
assert.equal(transformCrmValue("2026-09-30T12:00:00Z", "date"), "2026-09-30");

const company = applyImportMappings(
  "companies",
  { name: "Original", company_size: "" },
  { company_name: "Mapped", headcount: "120", owner_id: "external-owner" },
  [
    { leadely_field: "name", external_field: "company_name", sync_direction: "import", transformation: "trim", required: true },
    { leadely_field: "employee_count", external_field: "headcount", sync_direction: "bidirectional", transformation: "none", required: false },
    { leadely_field: "owner_user_id", external_field: "owner_id", sync_direction: "import", transformation: "none", required: false },
  ],
);
assert.deepEqual(company, { name: "Mapped", company_size: "120" });

assert.throws(
  () => applyImportMappings("contacts", { email: "" }, {}, [
    { leadely_field: "email", external_field: "email", sync_direction: "import", transformation: "lowercase", required: true },
  ]),
  /Required CRM field is missing/,
);

const watermark = "2026-09-30T10:00:00.000Z";
assert.equal(resolveImportConflict("leadely_wins", watermark, "2026-09-30T11:00:00.000Z", "2026-09-30T12:00:00.000Z"), "preserve_local");
assert.equal(resolveImportConflict("crm_wins", watermark, "2026-09-30T11:00:00.000Z", "2026-09-30T12:00:00.000Z"), "import");
assert.equal(resolveImportConflict("latest_update", watermark, "2026-09-30T13:00:00.000Z", "2026-09-30T12:00:00.000Z"), "preserve_local");
assert.equal(resolveImportConflict("latest_update", watermark, "2026-09-30T11:00:00.000Z", "2026-09-30T12:00:00.000Z"), "import");
assert.equal(resolveImportConflict("leadely_wins", watermark, "2026-09-30T09:00:00.000Z", "2026-09-30T12:00:00.000Z"), "import");
assert.equal(resolveImportConflict("crm_wins", watermark, "2026-09-30T12:00:00.000Z", "2026-09-30T09:00:00.000Z"), "preserve_local");

console.log("CRM sync mapping and conflict tests passed.");
