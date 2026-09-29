import { requirePlatform } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  await requirePlatform();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const tool = url.searchParams.get("tool") || "all";
  const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase();
  const admin = createAdminClient();
  let callsQuery = admin.from("mcp_tool_calls").select("id, workspace_id, connection_id, request_id, tool_name, status, duration_ms, result_count, error_code, created_at").order("created_at", { ascending: false }).limit(10_000);
  if (["success", "error"].includes(status)) callsQuery = callsQuery.eq("status", status);
  if (tool !== "all") callsQuery = callsQuery.eq("tool_name", tool);
  const [{ data: calls }, { data: workspaces }, { data: connections }] = await Promise.all([
    callsQuery,
    admin.from("workspaces").select("id, name"),
    admin.from("mcp_connections").select("id, name"),
  ]);
  const workspaceNames = Object.fromEntries((workspaces || []).map((item) => [item.id, item.name]));
  const connectionNames = Object.fromEntries((connections || []).map((item) => [item.id, item.name]));
  const rows = (calls || []).filter((call) => {
    if (!query) return true;
    return `${call.tool_name} ${workspaceNames[call.workspace_id] || ""} ${connectionNames[call.connection_id || ""] || ""} ${call.request_id || ""} ${call.error_code || ""}`.toLocaleLowerCase().includes(query);
  });
  const header = ["created_at", "workspace", "connection", "tool", "status", "duration_ms", "result_count", "request_id", "error_code"];
  const lines = [header.map(csvCell).join(","), ...rows.map((call) => [call.created_at, workspaceNames[call.workspace_id] || call.workspace_id, connectionNames[call.connection_id || ""] || "", call.tool_name, call.status, call.duration_ms, call.result_count ?? "", call.request_id || "", call.error_code || ""].map(csvCell).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leadely-mcp-audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
