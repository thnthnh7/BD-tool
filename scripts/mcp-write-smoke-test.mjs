import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: workspaces, error: workspaceError } = await admin.from("workspaces").select("id").order("created_at").limit(2);
if (workspaceError) throw workspaceError;
if (!workspaces?.length) throw new Error("No workspace available for MCP smoke test.");
const workspace = workspaces[0];
const { data: settings } = await admin.from("mcp_settings").select("write_tools_enabled").eq("id", 1).single();
const token = `ldmcp_${randomBytes(32).toString("base64url")}`;
const { data: connection, error: connectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspace.id, name: "Write approval smoke test", token_hash: createHash("sha256").update(token).digest("hex"), token_prefix: `${token.slice(0, 13)}…`, scopes: ["workspace:read", "crm:write", "quotes:write", "scrape:write"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
if (connectionError) throw connectionError;
await admin.from("mcp_settings").update({ write_tools_enabled: true }).eq("id", 1);

async function rpc(body) {
  const response = await fetch("http://localhost:3000/api/mcp", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}

try {
  const tools = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const [companyCall, concurrentCompanyCall] = await Promise.all([
    rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "create_company", arguments: { idempotencyKey: "smoke-company-001", name: "MCP direct-write smoke test", email: "private-smoke@example.com" } } }),
    rpc({ jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "create_company", arguments: { idempotencyKey: "smoke-company-001", name: "MCP direct-write smoke test", email: "private-smoke@example.com" } } }),
  ]);
  const companyResult = JSON.parse(companyCall.result?.content?.[0]?.text || "{}");
  const concurrentCompanyResult = JSON.parse(concurrentCompanyCall.result?.content?.[0]?.text || "{}");
  const replayCall = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_company", arguments: { idempotencyKey: "smoke-company-001", name: "MCP direct-write smoke test" } } });
  const replayResult = JSON.parse(replayCall.result?.content?.[0]?.text || "{}");
  const contactCall = await rpc({ jsonrpc: "2.0", id: 31, method: "tools/call", params: { name: "create_contact", arguments: { idempotencyKey: "smoke-contact-001", displayName: "MCP smoke contact", companyId: companyResult.id } } });
  const contactResult = JSON.parse(contactCall.result?.content?.[0]?.text || "{}");
  const leadCall = await rpc({ jsonrpc: "2.0", id: 32, method: "tools/call", params: { name: "create_lead", arguments: { idempotencyKey: "smoke-lead-001", companyId: companyResult.id, contactId: contactResult.id } } });
  const leadResult = JSON.parse(leadCall.result?.content?.[0]?.text || "{}");
  const taskCall = await rpc({ jsonrpc: "2.0", id: 33, method: "tools/call", params: { name: "create_task", arguments: { idempotencyKey: "smoke-task-001", title: "Follow up MCP smoke test", companyId: companyResult.id, contactId: contactResult.id } } });
  const taskResult = JSON.parse(taskCall.result?.content?.[0]?.text || "{}");
  const dealCall = await rpc({ jsonrpc: "2.0", id: 34, method: "tools/call", params: { name: "create_deal", arguments: { idempotencyKey: "smoke-deal-001", companyId: companyResult.id, contactId: contactResult.id, title: "MCP smoke deal", amount: 1000, currency: "USD" } } });
  const dealResult = JSON.parse(dealCall.result?.content?.[0]?.text || "{}");
  const companyUpdateCall = await rpc({ jsonrpc: "2.0", id: 35, method: "tools/call", params: { name: "update_company", arguments: { idempotencyKey: "smoke-company-update-001", companyId: companyResult.id, industry: "Software" } } });
  const companyUpdateResult = JSON.parse(companyUpdateCall.result?.content?.[0]?.text || "{}");
  const contactUpdateCall = await rpc({ jsonrpc: "2.0", id: 36, method: "tools/call", params: { name: "update_contact", arguments: { idempotencyKey: "smoke-contact-update-001", contactId: contactResult.id, jobTitle: "Buyer" } } });
  const contactUpdateResult = JSON.parse(contactUpdateCall.result?.content?.[0]?.text || "{}");
  const leadUpdateCall = await rpc({ jsonrpc: "2.0", id: 37, method: "tools/call", params: { name: "update_lead", arguments: { idempotencyKey: "smoke-lead-update-001", leadId: leadResult.id, status: "working" } } });
  const leadUpdateResult = JSON.parse(leadUpdateCall.result?.content?.[0]?.text || "{}");
  const dealUpdateCall = await rpc({ jsonrpc: "2.0", id: 38, method: "tools/call", params: { name: "update_deal", arguments: { idempotencyKey: "smoke-deal-update-001", dealId: dealResult.id, probability: 50 } } });
  const dealUpdateResult = JSON.parse(dealUpdateCall.result?.content?.[0]?.text || "{}");
  const { data: list, error: listError } = await admin.from("lead_lists").insert({ workspace_id: workspace.id, name: "MCP smoke list", owner_user_id: null }).select("id").single();
  if (listError) throw listError;
  const listCall = await rpc({ jsonrpc: "2.0", id: 39, method: "tools/call", params: { name: "add_company_to_list", arguments: { idempotencyKey: "smoke-list-member-001", listId: list.id, companyId: companyResult.id, leadId: leadResult.id, contactId: contactResult.id } } });
  const listResult = JSON.parse(listCall.result?.content?.[0]?.text || "{}");
  const quoteCall = await rpc({ jsonrpc: "2.0", id: 40, method: "tools/call", params: { name: "create_quote_draft", arguments: { idempotencyKey: "smoke-quote-001", title: "MCP smoke quote", dealId: dealResult.id, currency: "USD", items: [{ description: "Service", quantity: 1, unitPrice: 1000 }] } } });
  const quoteResult = JSON.parse(quoteCall.result?.content?.[0]?.text || "{}");
  const scrapeCall = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "request_start_maps_scrape", arguments: { idempotencyKey: "smoke-scrape-001", query: "coffee", location: "Singapore", maxResults: 5 } } });
  const scrapeRequest = JSON.parse(scrapeCall.result?.content?.[0]?.text || "{}");
  const { count: approvalNotificationCount } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("entity_type", "mcp_action_request").eq("entity_id", scrapeRequest.id);
  await admin.from("mcp_action_requests").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", scrapeRequest.id);
  const expiredCall = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_action_request", arguments: { requestId: scrapeRequest.id } } });
  const expiredRequest = JSON.parse(expiredCall.result?.content?.[0]?.text || "{}");
  const { data: auditRows } = await admin.from("mcp_tool_calls").select("input_summary").eq("connection_id", connection.id).eq("tool_name", "create_company");
  const auditText = JSON.stringify(auditRows || []);

  let workspaceIsolation = true;
  let foreignConnectionId;
  let foreignRequestId;
  if (workspaces.length > 1) {
    const foreignToken = `ldmcp_${randomBytes(32).toString("base64url")}`;
    const { data: foreignConnection, error: foreignConnectionError } = await admin.from("mcp_connections").insert({ workspace_id: workspaces[1].id, name: "MCP isolation smoke test", token_hash: createHash("sha256").update(foreignToken).digest("hex"), token_prefix: `${foreignToken.slice(0, 13)}…`, scopes: ["workspace:read"], expires_at: new Date(Date.now() + 300_000).toISOString() }).select("id").single();
    if (foreignConnectionError) throw foreignConnectionError;
    foreignConnectionId = foreignConnection.id;
    const { data: foreignRequest, error: foreignRequestError } = await admin.from("mcp_action_requests").insert({ workspace_id: workspaces[1].id, connection_id: foreignConnection.id, action_type: "start_maps_scrape", payload: {}, idempotency_key: "foreign-smoke-001" }).select("id").single();
    if (foreignRequestError) throw foreignRequestError;
    foreignRequestId = foreignRequest.id;
    const foreignRead = await rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_action_request", arguments: { requestId: foreignRequest.id } } });
    const foreignResult = JSON.parse(foreignRead.result?.content?.[0]?.text || "null");
    workspaceIsolation = foreignResult === null;
  }

  console.log(JSON.stringify({ writeToolsAdvertised: ["create_company", "create_contact", "create_lead", "create_task", "create_deal", "update_company", "update_contact", "update_lead", "update_deal", "add_company_to_list", "create_quote_draft"].every((name) => tools.result?.tools?.some((tool) => tool.name === name)), companyCreated: Boolean(companyResult.id), contactCreated: Boolean(contactResult.id), leadCreated: Boolean(leadResult.id), taskCreated: Boolean(taskResult.id), dealCreated: Boolean(dealResult.id), listMemberCreated: Boolean(listResult.id), quoteDraftCreated: Boolean(quoteResult.id), updatesApplied: companyUpdateResult.id === companyResult.id && contactUpdateResult.id === contactResult.id && leadUpdateResult.id === leadResult.id && dealUpdateResult.id === dealResult.id, concurrentIdempotency: concurrentCompanyResult.id === companyResult.id, idempotentReplay: replayResult.id === companyResult.id && replayResult.replayed === true, auditRedacted: !auditText.includes("private-smoke@example.com") && !auditText.includes("MCP direct-write smoke test"), scrapeQueued: scrapeRequest.status === "pending", approvalNotificationCreated: (approvalNotificationCount || 0) > 0, directApprovalUrl: scrapeRequest.approvalUrl?.includes(`/app/mcp?request=${scrapeRequest.id}`), expiresAutomatically: expiredRequest.status === "expired", workspaceIsolation }, null, 2));
  if (quoteResult.id) await admin.from("quotes").delete().eq("id", quoteResult.id).eq("workspace_id", workspace.id);
  if (list?.id) await admin.from("lead_lists").delete().eq("id", list.id).eq("workspace_id", workspace.id);
  if (taskResult.id) await admin.from("tasks").delete().eq("id", taskResult.id).eq("workspace_id", workspace.id);
  if (dealResult.id) await admin.from("deals").delete().eq("id", dealResult.id).eq("workspace_id", workspace.id);
  if (leadResult.id) await admin.from("leads").delete().eq("id", leadResult.id).eq("workspace_id", workspace.id);
  if (contactResult.id) await admin.from("contacts").delete().eq("id", contactResult.id).eq("workspace_id", workspace.id);
  if (companyResult.id) await admin.from("companies").delete().eq("id", companyResult.id).eq("workspace_id", workspace.id);
  if (foreignRequestId) {
    await admin.from("notifications").delete().eq("entity_type", "mcp_action_request").eq("entity_id", foreignRequestId);
    await admin.from("mcp_action_requests").delete().eq("id", foreignRequestId);
  }
  if (foreignConnectionId) await admin.from("mcp_connections").delete().eq("id", foreignConnectionId);
} finally {
  const { data: requests } = await admin.from("mcp_action_requests").select("id").eq("connection_id", connection.id);
  const requestIds = (requests || []).map((item) => item.id);
  if (requestIds.length) await admin.from("notifications").delete().eq("entity_type", "mcp_action_request").in("entity_id", requestIds);
  await admin.from("mcp_action_requests").delete().eq("connection_id", connection.id);
  await admin.from("mcp_idempotency_keys").delete().eq("connection_id", connection.id);
  await admin.from("mcp_tool_calls").delete().eq("connection_id", connection.id);
  await admin.from("mcp_connections").delete().eq("id", connection.id);
  await admin.from("mcp_settings").update({ write_tools_enabled: Boolean(settings?.write_tools_enabled) }).eq("id", 1);
}
