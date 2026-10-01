import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const suffix = randomUUID().slice(0, 8);
const workspaceIds = [];
const { data: originalAlertState, error: alertStateError } = await admin.from("mcp_settings").select("last_alert_fingerprint, last_alert_sent_at, last_alert_resolved_at").eq("id", 1).single();
if (alertStateError) throw alertStateError;

async function insert(table, value, columns = "*") {
  const { data, error } = await admin.from(table).insert(value).select(columns).single();
  if (error) throw error;
  return data;
}

try {
  const { data: plan, error: planError } = await admin.from("plans").select("id").limit(1).single();
  if (planError) throw planError;
  const workspaceA = await insert("workspaces", { name: `MCP DB contract A ${suffix}`, slug: `mcp-db-a-${suffix}`, type: "company", plan_id: plan.id });
  const workspaceB = await insert("workspaces", { name: `MCP DB contract B ${suffix}`, slug: `mcp-db-b-${suffix}`, type: "company", plan_id: plan.id });
  workspaceIds.push(workspaceA.id, workspaceB.id);
  const connection = await insert("crm_connections", { workspace_id: workspaceA.id, provider: "hubspot", status: "connected", sync_direction: "import", sync_objects: ["companies"] });
  const company = await insert("companies", { workspace_id: workspaceA.id, name: `MCP DB contract company ${suffix}` });
  const issue = await insert("crm_record_links", { workspace_id: workspaceA.id, connection_id: connection.id, object_type: "companies", leadely_record_id: company.id, external_record_id: `contract-${suffix}`, sync_status: "conflict" });

  const isolation = await admin.rpc("resolve_crm_sync_conflict", { p_workspace_id: workspaceB.id, p_issue_id: issue.id, p_resolution: "keep_local", p_requested_by: null });
  assert.ok(isolation.error, "Cross-workspace conflict resolution must fail.");

  const concurrentResolution = await Promise.all([
    admin.rpc("resolve_crm_sync_conflict", { p_workspace_id: workspaceA.id, p_issue_id: issue.id, p_resolution: "use_external", p_requested_by: null }),
    admin.rpc("resolve_crm_sync_conflict", { p_workspace_id: workspaceA.id, p_issue_id: issue.id, p_resolution: "use_external", p_requested_by: null }),
  ]);
  assert.ok(concurrentResolution.every((result) => !result.error));
  const { count: conflictRunCount, error: conflictCountError } = await admin.from("crm_sync_runs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceA.id).eq("connection_id", connection.id);
  if (conflictCountError) throw conflictCountError;
  assert.equal(conflictRunCount, 1, "Concurrent conflict resolution must create one run.");

  const failure = await insert("crm_sync_record_failures", { workspace_id: workspaceA.id, connection_id: connection.id, object_type: "companies", external_record_id: `failed-${suffix}`, error_message: "Contract-test failure" });
  const concurrentRetry = await Promise.all([
    admin.rpc("retry_crm_sync_record_failure", { p_workspace_id: workspaceA.id, p_failure_id: failure.id, p_requested_by: null }),
    admin.rpc("retry_crm_sync_record_failure", { p_workspace_id: workspaceA.id, p_failure_id: failure.id, p_requested_by: null }),
  ]);
  assert.ok(concurrentRetry.every((result) => !result.error));
  const { count: retryRunCount, error: retryCountError } = await admin.from("crm_sync_runs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceA.id).contains("cursor_state", { failureId: failure.id });
  if (retryCountError) throw retryCountError;
  assert.equal(retryRunCount, 1, "Concurrent record retry must create one run.");

  const alertFingerprint = `contract-${suffix}`;
  const alertTime = new Date().toISOString();
  const alertClaims = await Promise.all([
    admin.rpc("claim_mcp_alert_delivery", { p_fingerprint: alertFingerprint, p_sent_at: alertTime, p_cooldown_minutes: 60 }),
    admin.rpc("claim_mcp_alert_delivery", { p_fingerprint: alertFingerprint, p_sent_at: alertTime, p_cooldown_minutes: 60 }),
  ]);
  assert.ok(alertClaims.every((result) => !result.error));
  assert.equal(alertClaims.filter((result) => result.data === true).length, 1, "Concurrent alert delivery must be claimed once.");

  console.log("MCP database isolation and concurrency contract passed.");
} finally {
  if (workspaceIds.length) await admin.from("workspaces").delete().in("id", workspaceIds);
  await admin.from("mcp_settings").update(originalAlertState).eq("id", 1);
}
