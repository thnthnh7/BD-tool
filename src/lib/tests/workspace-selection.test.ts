import test from "node:test";
import assert from "node:assert/strict";
import { selectActiveMembership } from "@/lib/auth/session";

test("selects the preferred workspace only when the user is a member", () => {
  const memberships = [{ workspace_id: "first", role: "owner" }, { workspace_id: "second", role: "member" }];
  assert.equal(selectActiveMembership(memberships, "second")?.workspace_id, "second");
  assert.equal(selectActiveMembership(memberships, "unknown")?.workspace_id, "first");
  assert.equal(selectActiveMembership([], "second"), null);
});
