import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
  if (!issues.length) return { status: "healthy" as const, issues, metrics, delivery: "not_needed" as const };

  const webhookUrl = process.env.MCP_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return { status: "attention" as const, issues, metrics, delivery: "not_configured" as const };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "mcp.health.alert", severity: "warning", occurredAt: new Date().toISOString(), issues, metrics }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Alert webhook returned ${response.status}`);
    return { status: "attention" as const, issues, metrics, delivery: "sent" as const };
  } catch (error) {
    console.error("mcp alert delivery failed", error);
    return { status: "attention" as const, issues, metrics, delivery: "failed" as const };
  }
}
