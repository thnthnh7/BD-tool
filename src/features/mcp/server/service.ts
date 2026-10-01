import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mcpScopes, type McpScope } from "@/features/mcp/scopes";
import type { Json } from "@/lib/database.types";
import { retryMcpAuditWrite } from "@/features/mcp/server/audit-retry";

export function hashMcpToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateMcpToken() {
  return `ldmcp_${randomBytes(32).toString("base64url")}`;
}

export function normalizeMcpScopes(values: string[]): McpScope[] {
  const allowed = new Set<string>(mcpScopes);
  return [...new Set(values.filter((value): value is McpScope => allowed.has(value)))];
}

function auditSummary(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  const summary: Record<string, Json> = {};
  const safeValues = new Set(["status", "type", "priority", "language", "limit", "cursor", "maxResults", "maxPeoplePerPlace", "enrichPeople", "verifyEmails"]);
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key === "idempotencyKey") {
      summary[key] = "[redacted]";
    } else if (safeValues.has(key) && ["string", "number", "boolean"].includes(typeof item)) {
      summary[key] = item as string | number | boolean;
    } else {
      summary[key] = typeof item === "string" ? { present: Boolean(item), length: item.length } : { present: item != null };
    }
  }
  return summary;
}

export async function authenticateMcpToken(token: string) {
  const admin = createAdminClient();
  if (token.startsWith("ldaccess_") && token.length >= 32) {
    const now = new Date().toISOString();
    const { data } = await admin.from("mcp_oauth_tokens").select("id, connection_id, workspace_id, user_id, scopes, resource, access_expires_at, revoked_at").eq("access_token_hash", hashMcpToken(token)).is("revoked_at", null).gt("access_expires_at", now).maybeSingle();
    if (!data) return null;
    const { data: connection } = await admin.from("mcp_connections").select("status").eq("id", data.connection_id).maybeSingle();
    if (!connection || connection.status !== "active") return null;
    await Promise.all([
      admin.from("mcp_oauth_tokens").update({ last_used_at: now }).eq("id", data.id),
      admin.from("mcp_connections").update({ last_used_at: now }).eq("id", data.connection_id),
    ]);
    return { id: data.connection_id, workspace_id: data.workspace_id, created_by: data.user_id, name: "OAuth client", scopes: data.scopes, status: "active", expires_at: data.access_expires_at, resource: data.resource };
  }
  if (!token.startsWith("ldmcp_") || token.length < 32) return null;
  const { data } = await admin
    .from("mcp_connections")
    .select("id, workspace_id, created_by, name, scopes, status, expires_at")
    .eq("token_hash", hashMcpToken(token))
    .eq("status", "active")
    .maybeSingle();
  if (!data || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) return null;
  await admin.from("mcp_connections").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

export async function recordMcpCall(input: {
  workspaceId: string;
  connectionId: string;
  actorUserId: string | null;
  requestId?: string | null;
  toolName: string;
  status: "success" | "error";
  durationMs: number;
  inputSummary?: Record<string, unknown>;
  resultCount?: number | null;
  errorCode?: string | null;
}) {
  const row = {
    workspace_id: input.workspaceId,
    connection_id: input.connectionId,
    actor_user_id: input.actorUserId,
    request_id: input.requestId || null,
    tool_name: input.toolName,
    status: input.status,
    duration_ms: input.durationMs,
    input_summary: auditSummary(input.inputSummary),
    result_count: input.resultCount ?? null,
    error_code: input.errorCode || null,
  };
  try {
    await retryMcpAuditWrite(async () => {
      const { error } = await createAdminClient().from("mcp_tool_calls").insert(row);
      return { error };
    });
  } catch (error) {
    console.error("mcp audit persistence failed", { toolName: input.toolName, requestId: input.requestId || null, error: error instanceof Error ? error.message : "Unknown error" });
    throw new Error("MCP audit log could not be persisted.");
  }
}
