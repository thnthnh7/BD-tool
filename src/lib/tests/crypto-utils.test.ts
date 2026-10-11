import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "@/lib/crypto-utils";

test("workspace secrets use the dedicated encryption key", () => {
  const previousWorkspaceKey = process.env.WORKSPACE_SECRETS_KEY;
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    process.env.WORKSPACE_SECRETS_KEY = "test-workspace-secret";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    const encrypted = encryptSecret("apify-token");
    assert.equal(decryptSecret(encrypted), "apify-token");

    delete process.env.WORKSPACE_SECRETS_KEY;
    assert.throws(
      () => decryptSecret(encrypted),
      /WORKSPACE_SECRETS_KEY must be configured/,
    );
  } finally {
    if (previousWorkspaceKey === undefined) delete process.env.WORKSPACE_SECRETS_KEY;
    else process.env.WORKSPACE_SECRETS_KEY = previousWorkspaceKey;
    if (previousServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  }
});
