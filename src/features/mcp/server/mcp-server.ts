import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordMcpCall } from "@/features/mcp/server/service";
import type { McpScope } from "@/features/mcp/scopes";
import type { Json } from "@/lib/database.types";
import { appOrigin } from "@/features/mcp/server/oauth";

type Connection = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  scopes: string[];
};

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function registerAuditedTool<T extends Record<string, unknown>>(
  server: McpServer,
  connection: Connection,
  requestId: string | null,
  definition: { name: string; title: string; description: string; scope: McpScope; inputSchema: Record<string, z.ZodType>; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean } },
  handler: (input: T) => Promise<{ data: unknown; count?: number }>,
) {
  if (!connection.scopes.includes(definition.scope)) return;
  server.registerTool(definition.name, {
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: definition.annotations || { readOnlyHint: definition.scope.endsWith(":read"), destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    const started = Date.now();
    try {
      const result = await handler(input as T);
      await recordMcpCall({ workspaceId: connection.workspace_id, connectionId: connection.id, actorUserId: connection.created_by, requestId, toolName: definition.name, status: "success", durationMs: Date.now() - started, inputSummary: input as Record<string, unknown>, resultCount: result.count });
      return json(result.data);
    } catch (error) {
      await recordMcpCall({ workspaceId: connection.workspace_id, connectionId: connection.id, actorUserId: connection.created_by, requestId, toolName: definition.name, status: "error", durationMs: Date.now() - started, inputSummary: input as Record<string, unknown>, errorCode: "tool_error" });
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Tool execution failed." }] };
    }
  });
}

export function createLeadelyMcpServer(connection: Connection, requestId: string | null, writeToolsEnabled = false) {
  const server = new McpServer({ name: "Leadely", version: "1.0.0" });
  const admin = createAdminClient();

  registerAuditedTool(server, connection, requestId, {
    name: "get_workspace", title: "Get workspace", description: "Return the current Leadely workspace profile and subscription state.", scope: "workspace:read", inputSchema: {},
  }, async () => {
    const { data, error } = await admin.from("workspaces").select("id, name, slug, type, plan_id, plan_status, created_at").eq("id", connection.workspace_id).single();
    if (error) throw error;
    return { data, count: 1 };
  });

  registerAuditedTool<{ query?: string; limit?: number }>(server, connection, requestId, {
    name: "search_companies", title: "Search companies", description: "Search companies in this Leadely workspace.", scope: "crm:read",
    inputSchema: { query: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).default(20) },
  }, async ({ query = "", limit = 20 }) => {
    let request = admin.from("companies").select("id, name, domain, website, industry, company_size, phone, email, lifecycle_stage, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).limit(limit);
    if (query.trim()) request = request.ilike("name", `%${query.trim()}%`);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ query?: string; limit?: number }>(server, connection, requestId, {
    name: "search_contacts", title: "Search contacts", description: "Search contacts in this Leadely workspace.", scope: "crm:read",
    inputSchema: { query: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).default(20) },
  }, async ({ query = "", limit = 20 }) => {
    let request = admin.from("contacts").select("id, company_id, display_name, first_name, last_name, email, phone, job_title, linkedin_url, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).limit(limit);
    if (query.trim()) request = request.ilike("display_name", `%${query.trim()}%`);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ status?: string; limit?: number }>(server, connection, requestId, {
    name: "list_leads", title: "List leads", description: "List recent leads, optionally filtered by status.", scope: "crm:read",
    inputSchema: { status: z.enum(["new", "working", "connected", "qualified", "unqualified"]).optional(), limit: z.number().int().min(1).max(50).default(20) },
  }, async ({ status, limit = 20 }) => {
    let request = admin.from("leads").select("id, company_id, contact_id, status, source, score, score_reason, next_action_at, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).limit(limit);
    if (status) request = request.eq("status", status);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<Record<string, never>>(server, connection, requestId, {
    name: "list_scrape_sources", title: "List installed scrape sources", description: "Return scrape sources installed in this Leadely workspace.", scope: "sources:read", inputSchema: {},
  }, async () => {
    const { data: installed, error } = await admin.from("workspace_scrape_sources").select("source_id, installed_at").eq("workspace_id", connection.workspace_id).order("installed_at", { ascending: false });
    if (error) throw error;
    const ids = installed.map((row) => row.source_id);
    if (!ids.length) return { data: [], count: 0 };
    const { data: sources, error: sourceError } = await admin.from("scrape_sources").select("id, slug, title, description, categories, pricing_model, adapter_status, store_url").in("id", ids);
    if (sourceError) throw sourceError;
    return { data: sources, count: sources.length };
  });

  registerAuditedTool<{ query?: string; type?: string; limit?: number }>(server, connection, requestId, {
    name: "search_data_library", title: "Search Data Library", description: "Search normalized scrape records stored in the workspace Data Library.", scope: "data:read",
    inputSchema: { query: z.string().max(160).optional(), type: z.string().max(40).optional(), limit: z.number().int().min(1).max(50).default(20) },
  }, async ({ query = "", type, limit = 20 }) => {
    let request = admin.from("data_records").select("id, collection_id, record_type, title, canonical_url, normalized_data, captured_at").eq("workspace_id", connection.workspace_id).order("captured_at", { ascending: false }).limit(limit);
    if (query.trim()) request = request.ilike("title", `%${query.trim()}%`);
    if (type) request = request.eq("record_type", type);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ query: string; limit?: number }>(server, connection, requestId, {
    name: "search_knowledge", title: "Search knowledge", description: "Search extracted workspace documents and return short evidence excerpts.", scope: "knowledge:read",
    inputSchema: { query: z.string().min(2).max(200), limit: z.number().int().min(1).max(20).default(8) },
  }, async ({ query, limit = 8 }) => {
    const { data, error } = await admin.from("knowledge_chunks").select("id, document_id, chunk_index, content, metadata").eq("workspace_id", connection.workspace_id).ilike("content", `%${query.trim()}%`).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const excerpts = data.map((item) => ({ ...item, content: item.content.slice(0, 1200) }));
    return { data: excerpts, count: excerpts.length };
  });

  registerAuditedTool<{ quoteId?: string; limit?: number }>(server, connection, requestId, {
    name: "get_quotes", title: "Get quotes", description: "Get a quote by ID or list recent workspace quotes.", scope: "quotes:read",
    inputSchema: { quoteId: z.string().uuid().optional(), limit: z.number().int().min(1).max(25).default(10) },
  }, async ({ quoteId, limit = 10 }) => {
    let request = admin.from("quotes").select("id, public_id, title, project_type, status, quote_status_v2, currency, items, discount, vat_rate, valid_until, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).limit(limit);
    if (quoteId) request = request.eq("id", quoteId).limit(1);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ status?: string; limit?: number }>(server, connection, requestId, {
    name: "list_scrape_runs", title: "List scrape runs", description: "List recent scrape jobs with result counts, cost and the user who started each run.", scope: "scrape:read",
    inputSchema: { status: z.string().max(30).optional(), limit: z.number().int().min(1).max(50).default(20) },
  }, async ({ status, limit = 20 }) => {
    let request = admin.from("lead_scrape_jobs").select("id, source_id, created_by, query, location, status, places_found, people_found, apify_usage_usd, started_at, finished_at, created_at").eq("workspace_id", connection.workspace_id).order("created_at", { ascending: false }).limit(limit);
    if (status) request = request.eq("status", status);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  if (writeToolsEnabled) {
    registerAuditedTool<{ idempotencyKey: string; name: string; website?: string; industry?: string; email?: string; phone?: string; notes?: string }>(server, connection, requestId, {
      name: "create_company", title: "Create company", description: "Create a company immediately after the MCP client confirms this additive CRM change. Reuse the same idempotencyKey when retrying.", scope: "crm:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), name: z.string().min(1).max(160), website: z.string().url().max(500).optional(), industry: z.string().max(120).optional(), email: z.string().email().max(254).optional(), phone: z.string().max(60).optional(), notes: z.string().max(2000).optional() },
    }, async (input) => {
      const { idempotencyKey, ...companyInput } = input;
      const { data: company, error } = await admin.rpc("mcp_create_company", {
        p_workspace_id: connection.workspace_id,
        p_connection_id: connection.id,
        p_actor_user_id: connection.created_by,
        p_idempotency_key: idempotencyKey,
        p_company: companyInput as Json,
      });
      if (error) throw error;
      return { data: company, count: 1 };
    });

    registerAuditedTool<{ idempotencyKey: string; query: string; location: string; language?: string; maxResults?: number; enrichPeople?: boolean; maxPeoplePerPlace?: number; verifyEmails?: boolean }>(server, connection, requestId, {
      name: "request_start_maps_scrape", title: "Request Google Maps scrape", description: "Create a pending Google Maps scrape request. A workspace owner or admin must approve it before Apify starts and incurs usage.", scope: "scrape:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), query: z.string().min(1).max(200), location: z.string().min(1).max(200), language: z.string().min(2).max(10).default("en"), maxResults: z.number().int().min(1).max(50).default(20), enrichPeople: z.boolean().default(false), maxPeoplePerPlace: z.number().int().min(0).max(5).default(0), verifyEmails: z.boolean().default(false) },
    }, async (input) => {
      const { data: existing } = await admin.from("mcp_action_requests").select("id, action_type, status, created_at, expires_at").eq("connection_id", connection.id).eq("action_type", "start_maps_scrape").eq("idempotency_key", input.idempotencyKey).maybeSingle();
      if (existing) return { data: { ...existing, approvalUrl: `${appOrigin()}/app/mcp?request=${existing.id}`, replayed: true }, count: 1 };
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await admin.from("mcp_action_requests").insert({ workspace_id: connection.workspace_id, connection_id: connection.id, requested_by: connection.created_by, action_type: "start_maps_scrape", idempotency_key: input.idempotencyKey, expires_at: expiresAt, payload: input as Json }).select("id, action_type, status, created_at, expires_at").single();
      if (error) throw error;
      return { data: { ...data, approvalUrl: `${appOrigin()}/app/mcp?request=${data.id}`, requiresApproval: true }, count: 1 };
    });

    registerAuditedTool<{ requestId: string }>(server, connection, requestId, {
      name: "get_action_request", title: "Get action request", description: "Check the approval and execution status of an MCP write request.", scope: "workspace:read",
      inputSchema: { requestId: z.string().uuid() },
    }, async ({ requestId: actionId }) => {
      await admin.rpc("expire_mcp_action_requests", { p_workspace_id: connection.workspace_id });
      const { data, error } = await admin.from("mcp_action_requests").select("id, action_type, status, result, error_message, reviewed_at, completed_at, created_at").eq("id", actionId).eq("workspace_id", connection.workspace_id).maybeSingle();
      if (error) throw error;
      return { data, count: data ? 1 : 0 };
    });
  }

  return server;
}
