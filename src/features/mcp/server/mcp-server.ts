import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordMcpCall } from "@/features/mcp/server/service";
import type { McpScope } from "@/features/mcp/scopes";
import type { Json } from "@/lib/database.types";
import { appOrigin } from "@/features/mcp/server/oauth";
import { embedTexts, vectorLiteral } from "@/features/knowledge/server/embedding";

type Connection = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  scopes: string[];
};

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { items: value } };
}

function page<T>(items: T[], offset: number, limit: number) {
  const hasMore = items.length > limit;
  return { items: hasMore ? items.slice(0, limit) : items, nextCursor: hasMore ? String(offset + limit) : null, hasMore };
}

function cursorOffset(cursor?: string) {
  return cursor ? Number(cursor) : 0;
}

function boundedJson(value: Json, maxLength = 12000): Json {
  const serialized = JSON.stringify(value);
  return serialized.length <= maxLength ? value : { truncated: true, preview: serialized.slice(0, maxLength), originalLength: serialized.length };
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

  if (connection.scopes.includes("workspace:read")) {
    const workspaceUri = `leadely://workspace/${connection.workspace_id}/profile`;
    server.registerResource("workspace-profile", workspaceUri, { title: "Leadely workspace profile", description: "Workspace identity and subscription state for the connected Leadely tenant.", mimeType: "application/json" }, async () => {
      const { data, error } = await admin.from("workspaces").select("id, name, slug, type, plan_id, plan_status, created_at").eq("id", connection.workspace_id).single();
      if (error) throw error;
      return { contents: [{ uri: workspaceUri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    });
  }

  if (connection.scopes.includes("crm:read")) {
    const schemaUri = "leadely://schemas/crm";
    server.registerResource("crm-schema", schemaUri, { title: "Leadely CRM schema", description: "Relationships and writable fields for Leadely CRM records.", mimeType: "application/json" }, async () => ({ contents: [{ uri: schemaUri, mimeType: "application/json", text: JSON.stringify({ company: { links: ["contacts", "leads", "deals", "tasks"] }, contact: { links: ["company", "leads", "deals", "tasks"] }, lead: { statuses: ["new", "working", "connected", "qualified", "unqualified"] }, deal: { requires: ["company", "pipeline", "stage"], priorities: ["low", "medium", "high"] }, writePolicy: "Additive and constrained updates require MCP client confirmation. Paid scrape runs require Leadely owner/admin approval." }, null, 2) }] }));
    server.registerPrompt("research-prospect", { title: "Research a prospect", description: "Build a sourced prospect brief from Leadely CRM, Data Library and knowledge.", argsSchema: { companyName: z.string().min(1).max(160), objective: z.string().max(500).optional() } }, async ({ companyName, objective }) => ({ messages: [{ role: "user", content: { type: "text", text: `Research ${companyName} using Leadely tools. Check CRM records, Data Library evidence, scrape history and knowledge documents. ${objective ? `Objective: ${objective}. ` : ""}Separate verified facts from assumptions, cite record IDs or URLs, identify missing data, and recommend the next sales action.` } }] }));
    server.registerPrompt("prepare-sales-follow-up", { title: "Prepare sales follow-up", description: "Prepare a grounded follow-up plan for a lead or deal.", argsSchema: { recordId: z.string().uuid(), recordType: z.enum(["lead", "deal"]) } }, async ({ recordId, recordType }) => ({ messages: [{ role: "user", content: { type: "text", text: `Prepare a concise follow-up plan for Leadely ${recordType} ${recordId}. Review related company, contact, tasks and available evidence. Do not invent facts. Recommend message angle, next action, owner task and timing.` } }] }));
  }

  registerAuditedTool(server, connection, requestId, {
    name: "get_workspace", title: "Get workspace", description: "Return the current Leadely workspace profile and subscription state.", scope: "workspace:read", inputSchema: {},
  }, async () => {
    const { data, error } = await admin.from("workspaces").select("id, name, slug, type, plan_id, plan_status, created_at").eq("id", connection.workspace_id).single();
    if (error) throw error;
    return { data, count: 1 };
  });

  registerAuditedTool<{ query?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "search_companies", title: "Search companies", description: "Search companies in this Leadely workspace.", scope: "crm:read",
    inputSchema: { query: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ query = "", limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("companies").select("id, name, domain, website, industry, company_size, phone, email, lifecycle_stage, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (query.trim()) request = request.ilike("name", `%${query.trim()}%`);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ query?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "search_contacts", title: "Search contacts", description: "Search contacts in this Leadely workspace.", scope: "crm:read",
    inputSchema: { query: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ query = "", limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("contacts").select("id, company_id, display_name, first_name, last_name, email, phone, job_title, linkedin_url, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (query.trim()) request = request.ilike("display_name", `%${query.trim()}%`);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ status?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "list_leads", title: "List leads", description: "List recent leads, optionally filtered by status.", scope: "crm:read",
    inputSchema: { status: z.enum(["new", "working", "connected", "qualified", "unqualified"]).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ status, limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("leads").select("id, company_id, contact_id, status, source, score, score_reason, next_action_at, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (status) request = request.eq("status", status);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ companyId: string }>(server, connection, requestId, {
    name: "get_company", title: "Get company", description: "Get one workspace company with its CRM profile.", scope: "crm:read", inputSchema: { companyId: z.string().uuid() },
  }, async ({ companyId }) => {
    const { data, error } = await admin.from("companies").select("id, name, domain, website, industry, company_size, phone, email, address, tax_code, lifecycle_stage, lead_source, notes, owner_user_id, created_at, updated_at").eq("id", companyId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ contactId: string }>(server, connection, requestId, {
    name: "get_contact", title: "Get contact", description: "Get one workspace contact with its company relationship.", scope: "crm:read", inputSchema: { contactId: z.string().uuid() },
  }, async ({ contactId }) => {
    const { data, error } = await admin.from("contacts").select("id, company_id, display_name, first_name, last_name, email, phone, job_title, linkedin_url, relationship_strength, notes, owner_user_id, created_at, updated_at").eq("id", contactId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ leadId: string }>(server, connection, requestId, {
    name: "get_lead", title: "Get lead", description: "Get one workspace lead and its current qualification state.", scope: "crm:read", inputSchema: { leadId: z.string().uuid() },
  }, async ({ leadId }) => {
    const { data, error } = await admin.from("leads").select("id, company_id, contact_id, owner_user_id, status, source, score, score_reason, next_action_at, last_activity_at, converted_deal_id, created_at, updated_at").eq("id", leadId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ dealId: string }>(server, connection, requestId, {
    name: "get_deal", title: "Get deal", description: "Get one workspace deal with pipeline, stage and commercial details.", scope: "crm:read", inputSchema: { dealId: z.string().uuid() },
  }, async ({ dealId }) => {
    const { data, error } = await admin.from("deals").select("id, company_id, primary_contact_id, pipeline_id, stage_id, owner_user_id, title, description, deal_type, amount, currency, probability, expected_close_date, priority, source, lost_reason, won_at, lost_at, last_activity_at, next_activity_at, created_at, updated_at").eq("id", dealId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ taskId: string }>(server, connection, requestId, {
    name: "get_task", title: "Get task", description: "Get one workspace task with assignments and linked CRM records.", scope: "crm:read", inputSchema: { taskId: z.string().uuid() },
  }, async ({ taskId }) => {
    const { data, error } = await admin.from("tasks").select("id, assigned_to, deal_id, company_id, contact_id, type, title, description, priority, status, due_at, completed_at, created_by, created_at, updated_at").eq("id", taskId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
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

  registerAuditedTool<{ query?: string; type?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "search_data_library", title: "Search Data Library", description: "Search normalized scrape records stored in the workspace Data Library.", scope: "data:read",
    inputSchema: { query: z.string().max(160).optional(), type: z.string().max(40).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ query = "", type, limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("data_records").select("id, collection_id, record_type, title, canonical_url, normalized_data, captured_at").eq("workspace_id", connection.workspace_id).order("captured_at", { ascending: false }).range(offset, offset + limit);
    if (query.trim()) request = request.ilike("title", `%${query.trim()}%`);
    if (type) request = request.eq("record_type", type);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data.map((item) => ({ ...item, normalized_data: boundedJson(item.normalized_data, 4000) })), offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ recordId: string }>(server, connection, requestId, {
    name: "get_data_record", title: "Get data record", description: "Get one normalized Data Library record. Large normalized payloads are safely truncated.", scope: "data:read", inputSchema: { recordId: z.string().uuid() },
  }, async ({ recordId }) => {
    const { data, error } = await admin.from("data_records").select("id, collection_id, scrape_result_id, source_item_key, record_type, title, canonical_url, normalized_data, identity_keys, promoted_company_id, promoted_contact_id, captured_at, created_at, updated_at").eq("id", recordId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data: data ? { ...data, normalized_data: boundedJson(data.normalized_data) } : null, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ query: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "search_knowledge", title: "Search knowledge", description: "Hybrid semantic and keyword search across approved workspace knowledge, with source and relevance scores.", scope: "knowledge:read",
    inputSchema: { query: z.string().min(2).max(200), limit: z.number().int().min(1).max(20).default(8), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ query, limit = 8, cursor }) => {
    const offset = cursorOffset(cursor);
    const [embedding] = await embedTexts([query]);
    const { data, error } = await admin.rpc("match_mcp_knowledge_chunks", { p_workspace_id: connection.workspace_id, p_connection_id: connection.id, query_embedding: vectorLiteral(embedding), query_text: query.slice(0, 2000), match_count: Math.min(offset + limit + 1, 20) });
    if (error) throw error;
    const ranked = data.slice(offset).map((item) => ({ ...item, content: item.content.slice(0, 1600), metadata: boundedJson(item.metadata, 2000), score: Number(item.similarity || 0) * 0.72 + Number(item.text_rank || 0) * 0.28 }));
    const result = page(ranked, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ quoteId?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "get_quotes", title: "Get quotes", description: "Get a quote by ID or list recent workspace quotes.", scope: "quotes:read",
    inputSchema: { quoteId: z.string().uuid().optional(), limit: z.number().int().min(1).max(25).default(10), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ quoteId, limit = 10, cursor }) => {
    const offset = quoteId ? 0 : cursorOffset(cursor);
    let request = admin.from("quotes").select("id, public_id, title, project_type, status, quote_status_v2, currency, items, discount, vat_rate, valid_until, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (quoteId) request = request.eq("id", quoteId).limit(1);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data.map((item) => ({ ...item, items: boundedJson(item.items, 6000) })), offset, quoteId ? data.length : limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ status?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "list_scrape_runs", title: "List scrape runs", description: "List recent scrape jobs with result counts, cost and the user who started each run.", scope: "scrape:read",
    inputSchema: { status: z.string().max(30).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ status, limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("lead_scrape_jobs").select("id, source_id, created_by, query, location, status, places_found, people_found, apify_usage_usd, started_at, finished_at, created_at").eq("workspace_id", connection.workspace_id).order("created_at", { ascending: false }).range(offset, offset + limit);
    if (status) request = request.eq("status", status);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ runId: string }>(server, connection, requestId, {
    name: "get_scrape_run", title: "Get scrape run", description: "Get one workspace scrape run with progress, cost and result counts.", scope: "scrape:read", inputSchema: { runId: z.string().uuid() },
  }, async ({ runId }) => {
    const { data, error } = await admin.from("lead_scrape_jobs").select("id, source_id, created_by, query, location, language, max_results, filters, status, apify_actor_id, apify_run_id, apify_dataset_id, apify_usage_usd, places_found, places_imported, people_found, people_imported, enrich_people, max_people_per_place, verify_emails, started_at, finished_at, created_at, updated_at").eq("id", runId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<Record<string, never>>(server, connection, requestId, {
    name: "list_sales_pipelines", title: "List sales pipelines", description: "Return workspace sales pipelines and their ordered stages for deal creation and updates.", scope: "crm:read", inputSchema: {},
  }, async () => {
    const [{ data: pipelines, error: pipelineError }, { data: stages, error: stageError }] = await Promise.all([
      admin.from("pipelines").select("id, name, kind, is_default").eq("workspace_id", connection.workspace_id).order("is_default", { ascending: false }).order("name"),
      admin.from("pipeline_stages").select("id, pipeline_id, name, position, probability, stage_type").eq("workspace_id", connection.workspace_id).order("position"),
    ]);
    if (pipelineError) throw pipelineError;
    if (stageError) throw stageError;
    const data = pipelines.map((pipeline) => ({ ...pipeline, stages: stages.filter((stage) => stage.pipeline_id === pipeline.id) }));
    return { data, count: data.length };
  });

  registerAuditedTool<Record<string, never>>(server, connection, requestId, {
    name: "list_crm_integrations", title: "List CRM integrations", description: "Return configured CRM connections and synchronization health without exposing credentials or tokens.", scope: "crm:read", inputSchema: {},
  }, async () => {
    const { data, error } = await admin.from("crm_connections").select("id, provider, status, sync_direction, sync_objects, account_label, setup_step, webhook_status, last_synced_at, last_full_sync_at, next_sync_at, token_expires_at, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false });
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ connectionId?: string; status?: string; direction?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "list_crm_sync_runs", title: "List CRM sync runs", description: "Return synchronization history for CRM integrations in this workspace, including record counts and failure summaries.", scope: "crm:read",
    inputSchema: { connectionId: z.string().uuid().optional(), status: z.enum(["running", "completed", "partial", "failed"]).optional(), direction: z.enum(["import", "export"]).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ connectionId, status, direction, limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("crm_sync_runs").select("id, connection_id, direction, status, records_read, records_created, records_updated, records_skipped, records_failed, error_summary, started_at, completed_at").eq("workspace_id", connection.workspace_id).order("started_at", { ascending: false }).range(offset, offset + limit);
    if (connectionId) request = request.eq("connection_id", connectionId);
    if (status) request = request.eq("status", status);
    if (direction) request = request.eq("direction", direction);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ runId: string }>(server, connection, requestId, {
    name: "get_crm_sync_run", title: "Get CRM sync run", description: "Return one CRM synchronization run from this workspace with its processing totals and error summary.", scope: "crm:read",
    inputSchema: { runId: z.string().uuid() },
  }, async ({ runId }) => {
    const { data, error } = await admin.from("crm_sync_runs").select("id, connection_id, direction, status, records_read, records_created, records_updated, records_skipped, records_failed, error_summary, started_at, completed_at").eq("id", runId).eq("workspace_id", connection.workspace_id).maybeSingle();
    if (error) throw error;
    return { data, count: data ? 1 : 0 };
  });

  registerAuditedTool<{ connectionId: string; objectType?: string }>(server, connection, requestId, {
    name: "list_crm_field_mappings", title: "List CRM field mappings", description: "Return the configured field mappings for one workspace CRM connection.", scope: "crm:read",
    inputSchema: { connectionId: z.string().uuid(), objectType: z.enum(["contacts", "companies", "deals", "activities", "tasks", "notes"]).optional() },
  }, async ({ connectionId, objectType }) => {
    let request = admin.from("crm_field_mappings").select("id, connection_id, object_type, leadely_field, external_field, sync_direction, transformation, required, updated_at").eq("workspace_id", connection.workspace_id).eq("connection_id", connectionId).order("object_type").order("leadely_field");
    if (objectType) request = request.eq("object_type", objectType);
    const { data, error } = await request;
    if (error) throw error;
    return { data, count: data.length };
  });

  registerAuditedTool<{ connectionId?: string; status?: string; objectType?: string; limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "list_crm_sync_issues", title: "List CRM sync issues", description: "Return unresolved CRM record conflicts and errors without exposing provider credentials.", scope: "crm:read",
    inputSchema: { connectionId: z.string().uuid().optional(), status: z.enum(["conflict", "error"]).optional(), objectType: z.string().min(1).max(80).optional(), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ connectionId, status, objectType, limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    let request = admin.from("crm_record_links").select("id, connection_id, object_type, leadely_record_id, external_record_id, leadely_updated_at, external_updated_at, last_synced_at, sync_status, last_error, updated_at").eq("workspace_id", connection.workspace_id).in("sync_status", status ? [status] : ["conflict", "error"]).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (connectionId) request = request.eq("connection_id", connectionId);
    if (objectType) request = request.eq("object_type", objectType);
    const { data, error } = await request;
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ connectionId: string }>(server, connection, requestId, {
    name: "get_crm_sync_readiness", title: "Check CRM sync readiness", description: "Explain whether a CRM connection has the authorization, object selection and field mappings needed for synchronization.", scope: "crm:read",
    inputSchema: { connectionId: z.string().uuid() },
  }, async ({ connectionId }) => {
    const [{ data: crmConnection, error: connectionError }, { data: mappings, error: mappingError }] = await Promise.all([
      admin.from("crm_connections").select("id, provider, status, sync_direction, sync_objects, setup_step, webhook_status, token_expires_at, last_error").eq("id", connectionId).eq("workspace_id", connection.workspace_id).maybeSingle(),
      admin.from("crm_field_mappings").select("object_type, required").eq("connection_id", connectionId).eq("workspace_id", connection.workspace_id),
    ]);
    if (connectionError) throw connectionError;
    if (mappingError) throw mappingError;
    if (!crmConnection) return { data: null, count: 0 };
    const mappedObjects = [...new Set(mappings.map((mapping) => mapping.object_type))];
    const missingMappings = crmConnection.sync_objects.filter((objectType) => !mappedObjects.includes(objectType));
    const blockers: string[] = [];
    if (crmConnection.status !== "connected") blockers.push(`Connection status is ${crmConnection.status}.`);
    if (crmConnection.token_expires_at && new Date(crmConnection.token_expires_at).getTime() <= Date.now()) blockers.push("Provider authorization has expired.");
    if (!crmConnection.sync_objects.length) blockers.push("No CRM objects are selected for synchronization.");
    if (missingMappings.length) blockers.push(`Missing field mappings for: ${missingMappings.join(", ")}.`);
    return { data: { connectionId, provider: crmConnection.provider, ready: blockers.length === 0, blockers, syncDirection: crmConnection.sync_direction, syncObjects: crmConnection.sync_objects, mappedObjects, setupStep: crmConnection.setup_step, webhookStatus: crmConnection.webhook_status, lastError: crmConnection.last_error }, count: 1 };
  });

  registerAuditedTool<{ limit?: number; cursor?: string }>(server, connection, requestId, {
    name: "list_lead_lists", title: "List lead lists", description: "List workspace lead lists and their current status.", scope: "crm:read", inputSchema: { limit: z.number().int().min(1).max(50).default(20), cursor: z.string().regex(/^\d+$/).optional() },
  }, async ({ limit = 20, cursor }) => {
    const offset = cursorOffset(cursor);
    const { data, error } = await admin.from("lead_lists").select("id, name, description, source, status, owner_user_id, created_at, updated_at").eq("workspace_id", connection.workspace_id).order("updated_at", { ascending: false }).range(offset, offset + limit);
    if (error) throw error;
    const result = page(data, offset, limit);
    return { data: result, count: result.items.length };
  });

  registerAuditedTool<{ listId: string }>(server, connection, requestId, {
    name: "get_list", title: "Get lead list", description: "Get one workspace lead list and up to 50 current memberships.", scope: "crm:read", inputSchema: { listId: z.string().uuid() },
  }, async ({ listId }) => {
    const [{ data: list, error: listError }, { data: members, error: memberError }] = await Promise.all([
      admin.from("lead_lists").select("id, name, description, source, status, owner_user_id, scrape_job_id, created_at, updated_at").eq("id", listId).eq("workspace_id", connection.workspace_id).maybeSingle(),
      admin.from("lead_list_members").select("id, company_id, lead_id, contact_id, added_from, status, created_at").eq("list_id", listId).eq("workspace_id", connection.workspace_id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (listError) throw listError;
    if (memberError) throw memberError;
    return { data: list ? { ...list, members } : null, count: list ? 1 : 0 };
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

    const createCrmRecord = async (toolName: "create_contact" | "create_lead" | "create_task", idempotencyKey: string, payload: Record<string, unknown>) => {
      const { data, error } = await admin.rpc("mcp_create_crm_record", {
        p_workspace_id: connection.workspace_id,
        p_connection_id: connection.id,
        p_actor_user_id: connection.created_by,
        p_tool_name: toolName,
        p_idempotency_key: idempotencyKey,
        p_payload: payload as Json,
      });
      if (error) throw error;
      return { data, count: 1 };
    };

    const manageSalesWorkflow = async (toolName: "create_list" | "remove_company_from_list" | "update_task", idempotencyKey: string, payload: Record<string, unknown>) => {
      const { data, error } = await admin.rpc("mcp_manage_sales_workflow", { p_workspace_id: connection.workspace_id, p_connection_id: connection.id, p_actor_user_id: connection.created_by, p_tool_name: toolName, p_idempotency_key: idempotencyKey, p_payload: payload as Json });
      if (error) throw error;
      return { data, count: 1 };
    };

    registerAuditedTool<{ idempotencyKey: string; displayName: string; firstName?: string; lastName?: string; email?: string; phone?: string; jobTitle?: string; linkedinUrl?: string; companyId?: string; notes?: string }>(server, connection, requestId, {
      name: "create_contact", title: "Create contact", description: "Create a contact after the MCP client confirms this additive CRM change. Reuse the same idempotencyKey when retrying.", scope: "crm:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), displayName: z.string().min(1).max(160), firstName: z.string().max(80).optional(), lastName: z.string().max(80).optional(), email: z.string().email().max(254).optional(), phone: z.string().max(60).optional(), jobTitle: z.string().max(120).optional(), linkedinUrl: z.string().url().max(500).optional(), companyId: z.string().uuid().optional(), notes: z.string().max(2000).optional() },
    }, async ({ idempotencyKey, ...payload }) => createCrmRecord("create_contact", idempotencyKey, payload));

    registerAuditedTool<{ idempotencyKey: string; companyId?: string; contactId?: string; status?: "new" | "working" | "connected" | "qualified" | "unqualified"; source?: string; score?: number; scoreReason?: string; nextActionAt?: string }>(server, connection, requestId, {
      name: "create_lead", title: "Create lead", description: "Create a lead after the MCP client confirms this additive CRM change. Linked records must belong to the same workspace.", scope: "crm:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), companyId: z.string().uuid().optional(), contactId: z.string().uuid().optional(), status: z.enum(["new", "working", "connected", "qualified", "unqualified"]).default("new"), source: z.string().max(120).default("MCP"), score: z.number().int().min(0).max(100).optional(), scoreReason: z.string().max(500).optional(), nextActionAt: z.string().datetime({ offset: true }).optional() },
    }, async ({ idempotencyKey, ...payload }) => createCrmRecord("create_lead", idempotencyKey, payload));

    registerAuditedTool<{ idempotencyKey: string; title: string; description?: string; type?: "follow_up" | "call" | "email" | "meeting" | "proposal" | "review" | "other"; priority?: "low" | "medium" | "high"; dueAt?: string; companyId?: string; contactId?: string; dealId?: string }>(server, connection, requestId, {
      name: "create_task", title: "Create task", description: "Create a CRM task assigned to the connected user. Linked records must belong to the same workspace.", scope: "crm:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), title: z.string().min(1).max(200), description: z.string().max(2000).optional(), type: z.enum(["follow_up", "call", "email", "meeting", "proposal", "review", "other"]).default("follow_up"), priority: z.enum(["low", "medium", "high"]).default("medium"), dueAt: z.string().datetime({ offset: true }).optional(), companyId: z.string().uuid().optional(), contactId: z.string().uuid().optional(), dealId: z.string().uuid().optional() },
    }, async ({ idempotencyKey, ...payload }) => createCrmRecord("create_task", idempotencyKey, payload));

    registerAuditedTool<{ idempotencyKey: string; name: string; description?: string }>(server, connection, requestId, {
      name: "create_list", title: "Create lead list", description: "Create a new workspace lead list after client confirmation.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), name: z.string().min(1).max(160), description: z.string().max(1000).optional() },
    }, async ({ idempotencyKey, ...payload }) => manageSalesWorkflow("create_list", idempotencyKey, payload));

    registerAuditedTool<{ idempotencyKey: string; listId: string; companyId: string }>(server, connection, requestId, {
      name: "remove_company_from_list", title: "Remove company from list", description: "Remove a company membership from a workspace lead list after client confirmation.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), listId: z.string().uuid(), companyId: z.string().uuid() },
    }, async ({ idempotencyKey, ...payload }) => manageSalesWorkflow("remove_company_from_list", idempotencyKey, payload));

    registerAuditedTool<{ idempotencyKey: string; taskId: string; title?: string; description?: string; priority?: "low" | "medium" | "high"; status?: "open" | "completed" | "canceled"; dueAt?: string }>(server, connection, requestId, {
      name: "update_task", title: "Update task", description: "Update selected task fields or completion status after client confirmation.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), taskId: z.string().uuid(), title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional(), priority: z.enum(["low", "medium", "high"]).optional(), status: z.enum(["open", "completed", "canceled"]).optional(), dueAt: z.string().datetime({ offset: true }).optional() },
    }, async ({ idempotencyKey, ...payload }) => manageSalesWorkflow("update_task", idempotencyKey, payload));

    const mutateCrmRecord = async (toolName: "create_deal" | "update_company" | "update_contact" | "update_lead" | "update_deal", idempotencyKey: string, recordId: string | null, payload: Record<string, unknown>) => {
      const { data, error } = await admin.rpc("mcp_mutate_crm_record", { p_workspace_id: connection.workspace_id, p_connection_id: connection.id, p_actor_user_id: connection.created_by, p_tool_name: toolName, p_idempotency_key: idempotencyKey, p_record_id: recordId, p_payload: payload as Json });
      if (error) throw error;
      return { data, count: 1 };
    };

    registerAuditedTool<{ idempotencyKey: string; companyId: string; title: string; contactId?: string; pipelineId?: string; stageId?: string; description?: string; dealType?: "sales" | "partnership" | "referral" | "strategic" | "sponsorship" | "other"; amount?: number; currency?: string; probability?: number; expectedCloseDate?: string; priority?: "low" | "medium" | "high"; source?: string }>(server, connection, requestId, {
      name: "create_deal", title: "Create deal", description: "Create a deal in the workspace sales pipeline after client confirmation. The default pipeline and first open stage are used when omitted.", scope: "crm:write",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), companyId: z.string().uuid(), title: z.string().min(1).max(200), contactId: z.string().uuid().optional(), pipelineId: z.string().uuid().optional(), stageId: z.string().uuid().optional(), description: z.string().max(2000).optional(), dealType: z.enum(["sales", "partnership", "referral", "strategic", "sponsorship", "other"]).default("sales"), amount: z.number().int().min(0).optional(), currency: z.string().length(3).default("USD"), probability: z.number().int().min(0).max(100).optional(), expectedCloseDate: z.string().date().optional(), priority: z.enum(["low", "medium", "high"]).default("medium"), source: z.string().max(120).default("MCP") },
    }, async ({ idempotencyKey, ...payload }) => mutateCrmRecord("create_deal", idempotencyKey, null, payload));

    registerAuditedTool<{ idempotencyKey: string; companyId: string; name?: string; website?: string; industry?: string; companySize?: string; phone?: string; email?: string; notes?: string; lifecycleStage?: "prospect" | "active_opportunity" | "customer" | "partner" | "inactive" }>(server, connection, requestId, {
      name: "update_company", title: "Update company", description: "Update selected fields on a company in this workspace after client confirmation.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), companyId: z.string().uuid(), name: z.string().min(1).max(160).optional(), website: z.string().url().max(500).optional(), industry: z.string().max(120).optional(), companySize: z.string().max(80).optional(), phone: z.string().max(60).optional(), email: z.string().email().max(254).optional(), notes: z.string().max(2000).optional(), lifecycleStage: z.enum(["prospect", "active_opportunity", "customer", "partner", "inactive"]).optional() },
    }, async ({ idempotencyKey, companyId, ...payload }) => mutateCrmRecord("update_company", idempotencyKey, companyId, payload));

    registerAuditedTool<{ idempotencyKey: string; contactId: string; displayName?: string; firstName?: string; lastName?: string; email?: string; phone?: string; jobTitle?: string; linkedinUrl?: string; notes?: string }>(server, connection, requestId, {
      name: "update_contact", title: "Update contact", description: "Update selected fields on a contact in this workspace after client confirmation.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), contactId: z.string().uuid(), displayName: z.string().min(1).max(160).optional(), firstName: z.string().max(80).optional(), lastName: z.string().max(80).optional(), email: z.string().email().max(254).optional(), phone: z.string().max(60).optional(), jobTitle: z.string().max(120).optional(), linkedinUrl: z.string().url().max(500).optional(), notes: z.string().max(2000).optional() },
    }, async ({ idempotencyKey, contactId, ...payload }) => mutateCrmRecord("update_contact", idempotencyKey, contactId, payload));

    registerAuditedTool<{ idempotencyKey: string; leadId: string; status?: "new" | "working" | "connected" | "qualified" | "unqualified"; score?: number; scoreReason?: string; nextActionAt?: string }>(server, connection, requestId, {
      name: "update_lead", title: "Update lead", description: "Update status, score or next action on a lead in this workspace.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), leadId: z.string().uuid(), status: z.enum(["new", "working", "connected", "qualified", "unqualified"]).optional(), score: z.number().int().min(0).max(100).optional(), scoreReason: z.string().max(500).optional(), nextActionAt: z.string().datetime({ offset: true }).optional() },
    }, async ({ idempotencyKey, leadId, ...payload }) => mutateCrmRecord("update_lead", idempotencyKey, leadId, payload));

    registerAuditedTool<{ idempotencyKey: string; dealId: string; title?: string; description?: string; amount?: number; currency?: string; probability?: number; expectedCloseDate?: string; priority?: "low" | "medium" | "high" }>(server, connection, requestId, {
      name: "update_deal", title: "Update deal", description: "Update selected commercial fields on a deal in this workspace.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), dealId: z.string().uuid(), title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional(), amount: z.number().int().min(0).optional(), currency: z.string().length(3).optional(), probability: z.number().int().min(0).max(100).optional(), expectedCloseDate: z.string().date().optional(), priority: z.enum(["low", "medium", "high"]).optional() },
    }, async ({ idempotencyKey, dealId, ...payload }) => mutateCrmRecord("update_deal", idempotencyKey, dealId, payload));

    registerAuditedTool<{ idempotencyKey: string; listId: string; companyId: string; leadId?: string; contactId?: string }>(server, connection, requestId, {
      name: "add_company_to_list", title: "Add company to list", description: "Add a workspace company and its optional lead/contact context to a Leadely list.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), listId: z.string().uuid(), companyId: z.string().uuid(), leadId: z.string().uuid().optional(), contactId: z.string().uuid().optional() },
    }, async ({ idempotencyKey, ...payload }) => {
      const { data, error } = await admin.rpc("mcp_create_sales_artifact", { p_workspace_id: connection.workspace_id, p_connection_id: connection.id, p_actor_user_id: connection.created_by, p_tool_name: "add_company_to_list", p_idempotency_key: idempotencyKey, p_payload: payload as Json });
      if (error) throw error;
      return { data, count: 1 };
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

  if (writeToolsEnabled) {
    registerAuditedTool<{ idempotencyKey: string; title: string; projectType?: string; currency?: string; items?: Json[]; discount?: number; vatRate?: number; validUntil?: string; projectOverview?: string; timeline?: string; nextSteps?: string; dealId?: string }>(server, connection, requestId, {
      name: "create_quote_draft", title: "Create quote draft", description: "Create a draft quote for review in Leadely. This tool never sends or publishes the quote.", scope: "quotes:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), title: z.string().min(1).max(200), projectType: z.string().max(120).default("Custom project"), currency: z.string().length(3).default("USD"), items: z.array(z.record(z.string(), z.unknown())).max(100).default([]), discount: z.number().min(0).max(100).default(0), vatRate: z.number().min(0).max(100).default(0), validUntil: z.string().date().optional(), projectOverview: z.string().max(5000).optional(), timeline: z.string().max(2000).optional(), nextSteps: z.string().max(2000).optional(), dealId: z.string().uuid().optional() },
    }, async ({ idempotencyKey, ...payload }) => {
      const { data, error } = await admin.rpc("mcp_create_sales_artifact", { p_workspace_id: connection.workspace_id, p_connection_id: connection.id, p_actor_user_id: connection.created_by, p_tool_name: "create_quote_draft", p_idempotency_key: idempotencyKey, p_payload: payload as Json });
      if (error) throw error;
      return { data, count: 1 };
    });

    registerAuditedTool<{ idempotencyKey: string; quoteId: string }>(server, connection, requestId, {
      name: "request_mark_quote_sent", title: "Request quote status change", description: "Request owner/admin approval to mark a draft quote as sent. This updates lifecycle state but does not send email.", scope: "quotes:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), quoteId: z.string().uuid() },
    }, async (input) => {
      const { data: quote, error: quoteError } = await admin.from("quotes").select("id, title, status, quote_status_v2").eq("id", input.quoteId).eq("workspace_id", connection.workspace_id).maybeSingle();
      if (quoteError) throw quoteError;
      if (!quote) throw new Error("Quote not found in this workspace.");
      if ((quote.quote_status_v2 || quote.status) !== "draft") throw new Error("Only a draft quote can be marked as sent.");
      const { data: existing } = await admin.from("mcp_action_requests").select("id, action_type, status, created_at, expires_at").eq("connection_id", connection.id).eq("action_type", "mark_quote_sent").eq("idempotency_key", input.idempotencyKey).maybeSingle();
      if (existing) return { data: { ...existing, approvalUrl: `${appOrigin()}/app/mcp?request=${existing.id}`, replayed: true }, count: 1 };
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await admin.from("mcp_action_requests").insert({ workspace_id: connection.workspace_id, connection_id: connection.id, requested_by: connection.created_by, action_type: "mark_quote_sent", idempotency_key: input.idempotencyKey, expires_at: expiresAt, payload: { quoteId: input.quoteId, title: quote.title } }).select("id, action_type, status, created_at, expires_at").single();
      if (error) throw error;
      return { data: { ...data, approvalUrl: `${appOrigin()}/app/mcp?request=${data.id}`, requiresApproval: true }, count: 1 };
    });

    registerAuditedTool<{ idempotencyKey: string; connectionId: string; objects?: string[] }>(server, connection, requestId, {
      name: "request_start_crm_sync", title: "Request HubSpot synchronization", description: "Request owner or admin approval to import configured companies, contacts and deals from HubSpot. The approved run is processed asynchronously.", scope: "crm:write", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { idempotencyKey: z.string().min(8).max(120), connectionId: z.string().uuid(), objects: z.array(z.enum(["companies", "contacts", "deals"])).min(1).max(3).default(["companies", "contacts", "deals"]) },
    }, async (input) => {
      const { data: crmConnection, error: connectionError } = await admin.from("crm_connections").select("id, provider, status, sync_direction, sync_objects").eq("id", input.connectionId).eq("workspace_id", connection.workspace_id).maybeSingle();
      if (connectionError) throw connectionError;
      if (!crmConnection || crmConnection.provider !== "hubspot" || crmConnection.status !== "connected") throw new Error("An active HubSpot connection is required.");
      if (!["import", "bidirectional"].includes(crmConnection.sync_direction)) throw new Error("This CRM connection does not allow imports.");
      const requestedObjects = [...new Set(input.objects)].filter((objectType) => crmConnection.sync_objects.includes(objectType));
      if (!requestedObjects.length) throw new Error("None of the requested objects are enabled for this connection.");
      const { data: existing } = await admin.from("mcp_action_requests").select("id, action_type, status, created_at, expires_at, result").eq("connection_id", connection.id).eq("action_type", "start_crm_sync").eq("idempotency_key", input.idempotencyKey).maybeSingle();
      if (existing) return { data: { ...existing, approvalUrl: `${appOrigin()}/app/mcp?request=${existing.id}`, replayed: true }, count: 1 };
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await admin.from("mcp_action_requests").insert({ workspace_id: connection.workspace_id, connection_id: connection.id, requested_by: connection.created_by, action_type: "start_crm_sync", idempotency_key: input.idempotencyKey, expires_at: expiresAt, payload: { connectionId: input.connectionId, objects: requestedObjects } }).select("id, action_type, status, created_at, expires_at").single();
      if (error) throw error;
      return { data: { ...data, approvalUrl: `${appOrigin()}/app/mcp?request=${data.id}`, requiresApproval: true }, count: 1 };
    });
  }

  return server;
}
