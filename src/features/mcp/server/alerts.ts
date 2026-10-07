import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { mcpAlertFingerprint, shouldSuppressMcpAlert } from "@/features/mcp/server/alert-policy";
import { detectMcpAlertWebhookProvider, formatMcpAlertWebhookBody, type McpHealthAlertPayload } from "@/features/mcp/server/alert-webhook";

export async function evaluateAndSendMcpHealthAlert() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: calls, error: callError }, { data: requests, error: requestError }] = await Promise.all([
    admin.from("mcp_tool_calls").select("status, duration_ms").gte("created_at", since).limit(5000),
    admin.from("mcp_action_requests").select("status").gte("created_at", since).limit(1000),
  ]);
  if (callError) throw new Error(callError.message);
  if (requestError) throw new Error(requestError.message);

  const durations = calls.map((call) => call.duration_ms).sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] : 0;
  const errors = calls.filter((call) => call.status === "error").length;
  const errorRate = calls.length ? errors / calls.length : 0;
  const failedApprovals = requests.filter((request) => request.status === "failed").length;
  const issues = [
    calls.length >= 10 && errorRate >= 0.1 ? `MCP error rate is ${Math.round(errorRate * 100)}%` : null,
    calls.length > 0 && p95 >= 2_000 ? `MCP P95 latency is ${p95} ms` : null,
    failedApprovals > 0 ? `${failedApprovals} MCP approval execution(s) failed` : null,
  ].filter((issue): issue is string => Boolean(issue));
  const metrics = { windowMinutes: 60, calls: calls.length, errors, errorRate, p95, failedApprovals };
  const now = new Date();
  const { data: alertState, error: stateError } = await admin.from("mcp_settings").select("last_alert_fingerprint, last_alert_sent_at").eq("id", 1).single();
  if (stateError) throw new Error(stateError.message);
  if (!issues.length) {
    if (alertState.last_alert_fingerprint) await admin.from("mcp_settings").update({ last_alert_fingerprint: null, last_alert_resolved_at: now.toISOString() }).eq("id", 1);
    return { status: "healthy" as const, issues, metrics, delivery: "not_needed" as const };
  }

  const fingerprint = mcpAlertFingerprint(issues);
  const cooldownMinutes = Math.max(5, Number(process.env.MCP_ALERT_COOLDOWN_MINUTES || 60));
  if (shouldSuppressMcpAlert({ fingerprint, previousFingerprint: alertState.last_alert_fingerprint, previousSentAt: alertState.last_alert_sent_at, now, cooldownMinutes })) {
    return { status: "attention" as const, issues, metrics, delivery: "suppressed" as const };
  }

  const webhookUrl = process.env.MCP_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return { status: "attention" as const, issues, metrics, delivery: "not_configured" as const };
  const { data: claimed, error: claimError } = await admin.rpc("claim_mcp_alert_delivery", { p_fingerprint: fingerprint, p_sent_at: now.toISOString(), p_cooldown_minutes: cooldownMinutes });
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { status: "attention" as const, issues, metrics, delivery: "suppressed" as const };
  try {
    const payload: McpHealthAlertPayload = { event: "mcp.health.alert", severity: "warning", occurredAt: new Date().toISOString(), issues, metrics };
    const provider = detectMcpAlertWebhookProvider(webhookUrl, process.env.MCP_ALERT_WEBHOOK_PROVIDER);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatMcpAlertWebhookBody(provider, payload)),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Alert webhook returned ${response.status}`);
    return { status: "attention" as const, issues, metrics, delivery: "sent" as const };
  } catch (error) {
    console.error("mcp alert delivery failed", error);
    await admin.from("mcp_settings").update({ last_alert_fingerprint: null, last_alert_sent_at: null }).eq("id", 1).eq("last_alert_fingerprint", fingerprint).eq("last_alert_sent_at", now.toISOString());
    return { status: "attention" as const, issues, metrics, delivery: "failed" as const };
  }
}
