import assert from "node:assert/strict";
import { retryMcpAuditWrite } from "../src/features/mcp/server/audit-retry";
import { mcpAlertFingerprint, shouldSuppressMcpAlert } from "../src/features/mcp/server/alert-policy";
import { detectMcpAlertWebhookProvider, formatMcpAlertWebhookBody, type McpHealthAlertPayload } from "../src/features/mcp/server/alert-webhook";

async function main() {
  let attempts = 0;
  await retryMcpAuditWrite(async () => ({ error: ++attempts < 3 ? { message: "temporary" } : null }), async () => undefined);
  assert.equal(attempts, 3);

  attempts = 0;
  await assert.rejects(() => retryMcpAuditWrite(async () => { attempts += 1; return { error: { message: "persistent" } }; }, async () => undefined), /persistent/);
  assert.equal(attempts, 3);

  const issues = ["MCP error rate is 20%"];
  const fingerprint = mcpAlertFingerprint(issues);
  const now = new Date("2026-09-30T12:00:00.000Z");
  assert.equal(shouldSuppressMcpAlert({ fingerprint, previousFingerprint: fingerprint, previousSentAt: "2026-09-30T11:30:00.000Z", now, cooldownMinutes: 60 }), true);
  assert.equal(shouldSuppressMcpAlert({ fingerprint, previousFingerprint: fingerprint, previousSentAt: "2026-09-30T10:30:00.000Z", now, cooldownMinutes: 60 }), false);
  assert.equal(shouldSuppressMcpAlert({ fingerprint, previousFingerprint: mcpAlertFingerprint(["different"]), previousSentAt: "2026-09-30T11:59:00.000Z", now, cooldownMinutes: 60 }), false);

  const payload: McpHealthAlertPayload = { event: "mcp.health.alert", severity: "warning", occurredAt: now.toISOString(), issues, metrics: { windowMinutes: 60, calls: 10, errors: 2, errorRate: 0.2, p95: 2200, failedApprovals: 0 } };
  assert.equal(detectMcpAlertWebhookProvider("https://hooks.slack.com/services/example"), "slack");
  assert.equal(detectMcpAlertWebhookProvider("https://discord.com/api/webhooks/example"), "discord");
  assert.equal(detectMcpAlertWebhookProvider("https://example.logic.azure.com/workflows/example"), "teams");
  assert.equal(detectMcpAlertWebhookProvider("https://hooks.example.com/mcp"), "generic");
  assert.match(String((formatMcpAlertWebhookBody("slack", payload) as { text: string }).text), /Bizcraw MCP health warning/);
  assert.deepEqual(formatMcpAlertWebhookBody("generic", payload), payload);

  console.log("MCP audit retry and alert deduplication policies passed.");
}

void main();
