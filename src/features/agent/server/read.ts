import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { bindWorkspace, quoteViewFact, rankNameMatches, METRIC_VERSION } from "@/features/agent/logic";
import { retrieveKnowledge } from "@/features/knowledge/server/retrieve";
import { actorInputGuide, readableActorFields, unsupportedActorFields, validateActorInputObject } from "@/features/leads/actor-input";

/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic table and projection names are constrained by the tool allowlist below; Supabase's generated client cannot express their shared query shape. */

type Db = SupabaseClient<Database>;
type Role = "owner" | "admin" | "member";

export type ReadContext = {
  supabase: Db;
  workspaceId: string;
  userId: string;
  role: Role;
  locale: string;
};

const LIMIT = 20;
const paths = { company: "companies", contact: "contacts", lead: "leads", deal: "deals", quote: "quotes", task: "tasks" } as const;

function link(type: keyof typeof paths, id: string) {
  return `/app/${paths[type]}/${id}`;
}

function stamp(type: keyof typeof paths, row: Record<string, any>) {
  return { ...row, href: link(type, String(row.id)), asOf: row.updated_at || null };
}

async function timed(work: PromiseLike<{ data: Record<string, any>[] | null; error: { message: string } | null }>): Promise<Record<string, any>[]> {
  const result = await Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8_000)),
  ]);
  if (result.error) throw new Error("The workspace query failed.");
  return result.data ?? [];
}

async function searchNamed(ctx: ReadContext, kind: "company" | "contact" | "deal" | "quote" | "task", query: string) {
  const column = kind === "contact" ? "display_name" : kind === "company" ? "name" : "title";
  const table = kind === "company" ? "companies" : kind === "contact" ? "contacts" : kind === "deal" ? "deals" : kind === "quote" ? "quotes" : "tasks";
  const selected = kind === "company"
    ? "id, name, updated_at"
    : kind === "contact"
      ? "id, display_name, updated_at"
      : "id, title, updated_at";
  let request = (ctx.supabase as any).from(table).select(selected).order("updated_at", { ascending: false }).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  if (query.trim()) request = request.ilike(column, `%${query.trim()}%`);
  const rows = await timed(request);
  const named = (rows as { id: string; name?: string; display_name?: string; title?: string; updated_at: string }[]).map((row) => ({
    id: row.id,
    name: row.name || row.display_name || row.title || "",
    updated_at: row.updated_at,
  }));
  const ranked = rankNameMatches(query, named);
  if (ranked.kind !== "none" || !query.trim()) {
    return { match: ranked.kind === "none" ? "list" : ranked.kind, items: (ranked.items.length ? ranked.items : named).map((row) => ({ ...row, href: link(kind, row.id) })), partial: false };
  }
  const fuzzy = await timed((ctx.supabase as any).rpc("agent_fuzzy_names", { p_kind: kind, p_query: query.trim(), p_limit: 8 }));
  return {
    match: fuzzy.length ? "fuzzy" : "none",
    items: fuzzy.map((row) => ({ id: row.id, name: row.label, updated_at: row.updated_at, href: link(kind, row.id), score: row.score })),
    partial: false,
  };
}

export async function executeReadTool(ctx: ReadContext, name: string, args: Record<string, unknown>) {
  const text = (key: string) => (typeof args[key] === "string" ? args[key] : "");
  if (name === "search_actors") return searchActors(ctx, text("query"));
  if (name === "get_actor_contract") return actorContract(ctx, text("sourceId"));
  if (name === "get_actor_guide") return actorGuide(ctx, text("sourceId"));
  if (name === "get_actor_field_help") return actorFieldHelp(ctx, text("sourceId"), text("fieldName"));
  if (name === "get_actor_pricing") return actorPricing(ctx, text("sourceId"));
  if (name === "validate_actor_input" || name === "preview_actor_run") {
    const input = args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input as Record<string, unknown> : {};
    return validateActor(ctx, text("sourceId"), input, name === "preview_actor_run");
  }
  if (name === "search_companies") return searchNamed(ctx, "company", text("query"));
  if (name === "search_contacts") return searchNamed(ctx, "contact", text("query"));
  if (name === "search_deals") return searchNamed(ctx, "deal", text("query"));
  if (name === "search_quotes") return searchNamed(ctx, "quote", text("query"));
  if (name === "search_tasks") return searchNamed(ctx, "task", text("query"));
  if (name === "search_leads") return searchLeads(ctx, text("query"));
  if (name === "get_company_360") return company360(ctx, text("companyId"));
  if (name === "get_contact_360") return contact360(ctx, text("contactId"));
  if (name === "get_lead") return one(ctx, "leads", "lead", text("leadId"), "id, company_id, contact_id, status, source, score, next_action_at, last_activity_at, updated_at");
  if (name === "get_deal_360") return deal360(ctx, text("dealId"));
  if (name === "get_task") return taskStatus(ctx, text("taskId"));
  if (name === "get_quote_status" || name === "get_quote_engagement") return quoteStatus(ctx, text("quoteId"), text("dealId"));
  if (name === "get_recent_activity") return recentActivity(ctx);
  if (name === "search_data_library") return dataLibrary(ctx, text("query"));
  if (name === "search_knowledge") return knowledge(text("query"));
  if (name === "get_scrape_status") return scrapeStatus(ctx);
  if (name === "get_crm_sync_status") return crmStatus(ctx);
  if (name === "get_current_user_and_permissions") return permissions(ctx);
  if (name === "get_workspace_schema_capabilities") return capabilities();
  if (name === "get_pipeline_summary") return pipelineSummary(ctx);
  if (name === "get_quote_conversion") return quoteConversion(ctx);
  if (name === "get_overdue_work") return overdue(ctx);
  if (name === "get_stale_deals") return staleDeals(ctx, Number(args.days) || 14);
  if (name === "get_team_workload") return workload(ctx);
  if (name === "get_lead_source_performance") return leadSources(ctx);
  if (name === "get_sales_activity_summary") return activitySummary(ctx);
  if (name === "get_unviewed_sent_quotes") return unviewedQuotes(ctx);
  if (name === "get_monthly_forecast") return forecast(ctx);
  return { unsupported: true, limitation: "This assistant cannot answer that from workspace tools." };
}

async function installedActor(ctx: ReadContext, sourceId: string) {
  if (!sourceId) return null;
  const { data: installed, error: installedError } = await (ctx.supabase as any)
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_id", sourceId)
    .limit(1)
    .maybeSingle();
  if (installedError) throw new Error("The workspace query failed.");
  if (!installed) return null;
  const { data, error } = await (ctx.supabase as any)
    .from("scrape_sources")
    .select("id, title, slug, description, pricing_model, pricing_info, input_schema, example_input, schema_fetched_at, archived_at, actor_build_id, actor_build_number, actor_build_tag, contract_hash, readme_markdown, contract_fetch_status, contract_fetch_error, actor_store_url")
    .eq("id", sourceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("The Actor contract query failed.");
  return data as Record<string, any> | null;
}

async function searchActors(ctx: ReadContext, query: string) {
  const { data: installed, error } = await (ctx.supabase as any)
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", ctx.workspaceId)
    .limit(200);
  if (error) throw new Error("The workspace query failed.");
  const ids = (installed || []).map((row: { source_id: string }) => row.source_id);
  if (!ids.length) return { match: "none", items: [], partial: false };
  const { data: sources, error: sourceError } = await (ctx.supabase as any)
    .from("scrape_sources")
    .select("id, title, slug, description, pricing_model, schema_fetched_at, actor_build_number, contract_hash, contract_fetch_status")
    .in("id", ids)
    .is("archived_at", null)
    .limit(200);
  if (sourceError) throw new Error("The Actor search failed.");
  const needle = query.trim().toLocaleLowerCase();
  const matches = (sources || []).filter((row: Record<string, any>) => !needle || `${row.title} ${row.slug} ${row.description || ""}`.toLocaleLowerCase().includes(needle));
  return {
    match: matches.length ? "list" : "none",
    items: matches.slice(0, LIMIT).map((row: Record<string, any>) => ({
      id: row.id, title: row.title, slug: row.slug, description: row.description, pricingModel: row.pricing_model,
      schemaFetchedAt: row.schema_fetched_at, buildNumber: row.actor_build_number, contractHash: row.contract_hash,
      contractStatus: row.contract_fetch_status, href: `/app/leads/scrape/new?source=${row.id}`, actorUrl: `https://apify.com/${row.slug}`,
    })),
    partial: matches.length > LIMIT,
  };
}

function safeActorFields(row: Record<string, any>) {
  return readableActorFields(row.input_schema, row.example_input).map((field) => ({
    name: field.name, label: field.label, description: field.description, kind: field.kind, required: field.required,
    example: field.secret ? "" : field.exampleValue, options: field.options, suggestions: field.suggestions,
    section: field.sectionCaption, sectionDescription: field.sectionDescription, minimum: field.minimum, maximum: field.maximum,
    minLength: field.minLength, maxLength: field.maxLength, minItems: field.minItems, maxItems: field.maxItems,
    pattern: field.pattern, unit: field.unit, dateType: field.dateType, uniqueItems: field.uniqueItems,
    inputFormat: field.editor === "schemaBased" ? "json-fallback" : field.kind, secret: field.secret,
  }));
}

async function actorContract(ctx: ReadContext, sourceId: string) {
  const actor = await installedActor(ctx, sourceId);
  if (!actor) return { found: false, limitation: "This Actor is not installed in the current workspace." };
  return {
    found: true,
    actor: { id: actor.id, title: actor.title, slug: actor.slug, description: actor.description, href: `/app/leads/scrape/new?source=${actor.id}` },
    guide: actorInputGuide(actor.input_schema),
    fields: safeActorFields(actor),
    unsupportedFields: unsupportedActorFields(actor.input_schema),
    schemaFetchedAt: actor.schema_fetched_at,
    build: { id: actor.actor_build_id, number: actor.actor_build_number, tag: actor.actor_build_tag },
    contractHash: actor.contract_hash,
    contractStatus: actor.contract_fetch_status,
    actorUrl: actor.actor_store_url || `https://apify.com/${actor.slug}`,
  };
}

async function actorGuide(ctx: ReadContext, sourceId: string) {
  const actor = await installedActor(ctx, sourceId);
  if (!actor) return { found: false, limitation: "This Actor is not installed in the current workspace." };
  return {
    found: true,
    actor: { id: actor.id, title: actor.title, slug: actor.slug },
    sourceType: "default-build-readme",
    readmeMarkdown: actor.readme_markdown || "",
    build: { id: actor.actor_build_id, number: actor.actor_build_number, tag: actor.actor_build_tag },
    contractHash: actor.contract_hash,
    fetchedAt: actor.schema_fetched_at,
    contractStatus: actor.contract_fetch_status,
    actorUrl: actor.actor_store_url || `https://apify.com/${actor.slug}`,
    limitation: actor.readme_markdown ? undefined : "This Actor does not publish a README for its current default build.",
  };
}

async function actorFieldHelp(ctx: ReadContext, sourceId: string, fieldName: string) {
  const contract = await actorContract(ctx, sourceId);
  if (!contract.found || !("fields" in contract) || !contract.fields) return contract;
  const field = contract.fields.find((item) => item.name === fieldName || item.label.toLocaleLowerCase() === fieldName.toLocaleLowerCase());
  return field ? { found: true, actor: contract.actor, field, schemaFetchedAt: contract.schemaFetchedAt } : { found: false, limitation: "That field is not present in the Actor's current input schema." };
}

async function actorPricing(ctx: ReadContext, sourceId: string) {
  const actor = await installedActor(ctx, sourceId);
  if (!actor) return { found: false, limitation: "This Actor is not installed in the current workspace." };
  return {
    found: true, actor: { id: actor.id, title: actor.title, slug: actor.slug }, pricingModel: actor.pricing_model,
    pricingInfo: actor.pricing_info || null,
    limitation: "Final cost is determined by Apify, the Actor's current pricing, events and run input. No run has been started.",
  };
}

async function validateActor(ctx: ReadContext, sourceId: string, input: Record<string, unknown>, preview: boolean) {
  const actor = await installedActor(ctx, sourceId);
  if (!actor) return { valid: false, limitation: "This Actor is not installed in the current workspace." };
  const fields = readableActorFields(actor.input_schema, actor.example_input);
  const unsupportedRequired = unsupportedActorFields(actor.input_schema).filter((field) => field.required);
  if (unsupportedRequired.length) return { valid: false, unsupportedRequired, limitation: "Bizcraw cannot safely prepare this Actor until these required controls are supported." };
  const secretNames = fields.filter((field) => field.secret).map((field) => field.name);
  if (secretNames.some((name) => input[name] != null && input[name] !== "")) {
    return { valid: false, limitation: "Enter secret fields directly in the secure Actor form; the AI Agent does not accept or retain secret values.", secretFields: secretNames };
  }
  const result = validateActorInputObject(fields, input);
  if ("error" in result) return { valid: false, error: result.error, field: result.field };
  return {
    valid: true,
    normalizedInput: result.body,
    preview,
    startsRun: false,
    pricingModel: actor.pricing_model,
    warning: preview ? "This is a non-billable preview. Review the input and Actor pricing before starting a run from the scrape page." : undefined,
    href: `/app/leads/scrape/new?source=${actor.id}`,
  };
}

async function one(ctx: ReadContext, table: "leads", type: "lead", id: string, columns: string) {
  if (!id) return { found: false };
  let request = (ctx.supabase as any).from(table).select(columns).eq("id", id).limit(1);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const row = (rows as { id: string; updated_at?: string }[])[0];
  return row ? { found: true, record: stamp(type, row) } : { found: false };
}

async function searchLeads(ctx: ReadContext, query: string) {
  let request = (ctx.supabase as any).from("leads").select("id, company_id, contact_id, status, source, updated_at").order("updated_at", { ascending: false }).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  return { match: query ? "list" : "list", items: rows.map((row) => ({ ...row, href: link("lead", row.id) })), partial: rows.length >= LIMIT };
}

async function company360(ctx: ReadContext, companyId: string) {
  if (!companyId) return { found: false };
  let companyQuery = (ctx.supabase as any).from("companies").select("id, name, domain, website, industry, lifecycle_stage, owner_user_id, notes, updated_at").eq("id", companyId).limit(1);
  companyQuery = bindWorkspace(companyQuery, ctx.workspaceId);
  const companies = await timed(companyQuery);
  const company = companies[0];
  if (!company) return { found: false };
  const related = async (table: "contacts" | "leads" | "deals" | "quotes" | "tasks" | "activities", columns: string) => {
    let request = (ctx.supabase as any).from(table).select(columns).eq("company_id", companyId).limit(8);
    request = bindWorkspace(request, ctx.workspaceId);
    return timed(request);
  };
  const [contacts, leads, deals, tasks, activities, lists] = await Promise.all([
    related("contacts", "id, display_name, email, updated_at"),
    related("leads", "id, status, source, updated_at"),
    related("deals", "id, title, amount, currency, updated_at"),
    related("tasks", "id, title, status, due_at, updated_at"),
    related("activities", "id, activity_type, title, occurred_at"),
    timed(bindWorkspace((ctx.supabase as any).from("lead_list_members").select("list_id, created_at").eq("company_id", companyId).limit(8), ctx.workspaceId)),
  ]);
  const dealIds = deals.map((deal) => deal.id);
  const quotes = dealIds.length
    ? await timed(bindWorkspace((ctx.supabase as any).from("quotes").select("id, title, quote_status_v2, revision_number, updated_at").in("deal_id", dealIds).limit(8), ctx.workspaceId))
    : [];
  const open = tasks.filter((task) => task.status === "open");
  const overdue = open.filter((task) => task.due_at && task.due_at < new Date().toISOString());
  return {
    found: true,
    company: stamp("company", company),
    contacts: contacts.map((row) => stamp("contact", row)),
    leads: leads.map((row) => stamp("lead", row)),
    deals: deals.map((row) => stamp("deal", row)),
    quotes: quotes.map((row) => stamp("quote", row)),
    tasks: tasks.map((row) => stamp("task", row)),
    activities,
    lists,
    openCount: open.length,
    overdueCount: overdue.length,
    lastActivityAt: activities[0]?.occurred_at || company.updated_at,
    partial: [contacts, leads, deals, quotes, tasks, activities, lists].some((rows) => rows.length >= 8),
  };
}

async function contact360(ctx: ReadContext, contactId: string) {
  if (!contactId) return { found: false };
  let request = (ctx.supabase as any).from("contacts").select("id, company_id, display_name, email, phone, job_title, updated_at").eq("id", contactId).limit(1);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const contact = rows[0];
  if (!contact) return { found: false };
  return { found: true, contact: stamp("contact", contact) };
}

async function deal360(ctx: ReadContext, dealId: string) {
  if (!dealId) return { found: false };
  let request = (ctx.supabase as any).from("deals").select("id, company_id, primary_contact_id, pipeline_id, stage_id, owner_user_id, title, amount, currency, probability, priority, expected_close_date, lost_reason, won_at, lost_at, last_activity_at, updated_at").eq("id", dealId).limit(1);
  request = bindWorkspace(request, ctx.workspaceId);
  const deals = await timed(request);
  const deal = deals[0];
  if (!deal) return { found: false };
  const [company, contact, stage, tasks, quotes, activities, stakeholders] = await Promise.all([
    timed(bindWorkspace((ctx.supabase as any).from("companies").select("id, name, updated_at").eq("id", deal.company_id).limit(1), ctx.workspaceId)),
    deal.primary_contact_id ? timed(bindWorkspace((ctx.supabase as any).from("contacts").select("id, display_name, updated_at").eq("id", deal.primary_contact_id).limit(1), ctx.workspaceId)) : Promise.resolve([]),
    timed(bindWorkspace((ctx.supabase as any).from("pipeline_stages").select("id, name, stage_type").eq("id", deal.stage_id).limit(1), ctx.workspaceId)),
    timed(bindWorkspace((ctx.supabase as any).from("tasks").select("id, title, status, due_at, completed_at, updated_at").eq("deal_id", dealId).limit(12), ctx.workspaceId)),
    timed(bindWorkspace((ctx.supabase as any).from("quotes").select("id, title, revision_number, quote_status_v2, sent_at, valid_until, supersedes_quote_id, updated_at").eq("deal_id", dealId).order("revision_number", { ascending: false }).limit(5), ctx.workspaceId)),
    timed(bindWorkspace((ctx.supabase as any).from("activities").select("id, activity_type, title, occurred_at").eq("deal_id", dealId).order("occurred_at", { ascending: false }).limit(8), ctx.workspaceId)),
    timed(bindWorkspace((ctx.supabase as any).from("deal_contacts").select("contact_id, stakeholder_role").eq("deal_id", dealId).limit(8), ctx.workspaceId)),
  ]);
  const latest = quotes[0] || null;
  const engagement = latest ? await quoteEvents(ctx, latest.id) : [];
  return {
    found: true,
    deal: stamp("deal", deal),
    company: company[0] ? stamp("company", company[0]) : null,
    primaryContact: contact[0] ? stamp("contact", contact[0]) : null,
    stage: stage[0] || null,
    stakeholders,
    tasks: {
      open: tasks.filter((task) => task.status === "open" && (!task.due_at || task.due_at >= new Date().toISOString())),
      overdue: tasks.filter((task) => task.status === "open" && task.due_at && task.due_at < new Date().toISOString()),
      completed: tasks.filter((task) => task.status === "completed"),
      canceled: tasks.filter((task) => task.status === "canceled"),
    },
    latestQuote: latest ? { ...stamp("quote", latest), engagement: quoteViewFact(engagement), events: engagement } : null,
    activities,
  };
}

async function quoteEvents(ctx: ReadContext, quoteId: string) {
  let request = (ctx.supabase as any).from("quote_engagement_events").select("event_type, section, occurred_at").eq("quote_id", quoteId).order("occurred_at", { ascending: false }).limit(20);
  request = bindWorkspace(request, ctx.workspaceId);
  return timed(request);
}

async function quoteStatus(ctx: ReadContext, quoteId: string, dealId: string) {
  let request = (ctx.supabase as any).from("quotes").select("id, title, status, quote_status_v2, sent_at, valid_until, revision_number, supersedes_quote_id, deal_id, updated_at").order("revision_number", { ascending: false }).limit(5);
  request = bindWorkspace(request, ctx.workspaceId);
  if (quoteId) request = request.eq("id", quoteId);
  else if (dealId) request = request.eq("deal_id", dealId);
  else return { found: false };
  const quotes = await timed(request);
  const quote = quotes[0];
  if (!quote) return { found: false };
  const events = await quoteEvents(ctx, quote.id);
  const view = quoteViewFact(events);
  return { found: true, selectedRevision: quote.revision_number, quote: stamp("quote", quote), view, events, partial: quotes.length >= 5 };
}

async function taskStatus(ctx: ReadContext, taskId: string) {
  if (!taskId) return { found: false };
  let request = (ctx.supabase as any).from("tasks").select("id, title, status, assigned_to, type, priority, due_at, completed_at, company_id, contact_id, deal_id, updated_at").eq("id", taskId).limit(1);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const task = rows[0];
  if (!task) return { found: false };
  const overdueMs = task.status === "open" && task.due_at && task.due_at < new Date().toISOString() ? Date.now() - new Date(task.due_at).getTime() : 0;
  return { found: true, task: stamp("task", task), overdueMs };
}

async function recentActivity(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("activities").select("id, activity_type, title, company_id, deal_id, occurred_at").order("occurred_at", { ascending: false }).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  return { items: rows, partial: rows.length >= LIMIT, asOf: new Date().toISOString() };
}

async function dataLibrary(ctx: ReadContext, query: string) {
  let request = (ctx.supabase as any).from("data_records").select("id, title, record_type, canonical_url, captured_at").order("captured_at", { ascending: false }).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  if (query.trim()) request = request.ilike("title", `%${query.trim()}%`);
  const rows = await timed(request);
  return { items: rows, partial: rows.length >= LIMIT };
}

async function knowledge(query: string) {
  const hits = await retrieveKnowledge(query || "workspace", 5);
  return { items: hits.map((hit) => ({ documentId: hit.documentId, fileName: hit.fileName, excerpt: hit.content.slice(0, 500), score: hit.score })), untrusted: true };
}

async function scrapeStatus(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("lead_scrape_jobs").select("id, status, query, location, places_found, created_at").order("created_at", { ascending: false }).limit(8);
  request = bindWorkspace(request, ctx.workspaceId);
  return { items: await timed(request), asOf: new Date().toISOString() };
}

async function crmStatus(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("crm_sync_runs").select("id, status, records_read, records_failed, started_at, completed_at").order("started_at", { ascending: false }).limit(8);
  request = bindWorkspace(request, ctx.workspaceId);
  return { items: await timed(request), asOf: new Date().toISOString() };
}

function permissions(ctx: ReadContext) {
  return {
    userId: ctx.userId,
    role: ctx.role,
    locale: ctx.locale,
    readScope: "All records in the current workspace. Members are not limited to records they own.",
    writesRequireConfirmation: true,
  };
}

function capabilities() {
  return {
    entities: ["company", "contact", "lead", "deal", "quote", "task"],
    taskStatuses: ["open", "completed", "canceled"],
    quoteEvents: ["opened", "section_viewed", "pdf_downloaded", "accepted", "rejected"],
    limitation: "Email delivery events are not stored separately from quote-page engagement.",
    metricVersion: METRIC_VERSION,
  };
}

async function openDeals(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("deals").select("id, title, amount, currency, probability, source, last_activity_at, stage_id, owner_user_id, updated_at").is("won_at", null).is("lost_at", null).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  return { rows, partial: rows.length >= LIMIT };
}

async function pipelineSummary(ctx: ReadContext) {
  const { rows, partial } = await openDeals(ctx);
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) || 0) + row.amount);
  return { openCount: rows.length, totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount })), mixedCurrenciesCombined: false, partial, metricVersion: METRIC_VERSION, asOf: new Date().toISOString() };
}

async function quoteConversion(ctx: ReadContext) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  let request = (ctx.supabase as any).from("quotes").select("id, quote_status_v2, status, sent_at, updated_at").gte("updated_at", start.toISOString()).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const sent = rows.filter((row) => (row.quote_status_v2 || row.status) === "sent" || row.sent_at).length;
  const accepted = rows.filter((row) => (row.quote_status_v2 || row.status) === "accepted").length;
  return { from: start.toISOString(), to: new Date().toISOString(), sent, accepted, rate: sent ? accepted / sent : null, partial: rows.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function overdue(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("tasks").select("id, title, due_at, assigned_to, deal_id, company_id, updated_at").eq("status", "open").lt("due_at", new Date().toISOString()).order("due_at").limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  return { items: rows.map((row) => stamp("task", row)), partial: rows.length >= LIMIT, asOf: new Date().toISOString() };
}

async function staleDeals(ctx: ReadContext, days: number) {
  const cutoff = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000).toISOString();
  let request = (ctx.supabase as any).from("deals").select("id, title, last_activity_at, currency, amount, updated_at").is("won_at", null).is("lost_at", null).or(`last_activity_at.is.null,last_activity_at.lt.${cutoff}`).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  return { days, cutoff, items: rows.map((row) => stamp("deal", row)), partial: rows.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function workload(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("tasks").select("assigned_to").eq("status", "open").limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.assigned_to || "unassigned", (counts.get(row.assigned_to || "unassigned") || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { items: ranked.map(([assignee, open]) => ({ assignee, open })), partial: rows.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function leadSources(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("leads").select("source").limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.source || "unknown", (counts.get(row.source || "unknown") || 0) + 1);
  return { items: [...counts.entries()].map(([source, leads]) => ({ source, leads })), partial: rows.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function activitySummary(ctx: ReadContext) {
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let request = (ctx.supabase as any).from("activities").select("activity_type").gte("occurred_at", from).limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const rows = await timed(request);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.activity_type, (counts.get(row.activity_type) || 0) + 1);
  return { from, to: new Date().toISOString(), items: [...counts.entries()].map(([type, count]) => ({ type, count })), partial: rows.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function unviewedQuotes(ctx: ReadContext) {
  let request = (ctx.supabase as any).from("quotes").select("id, title, sent_at, quote_status_v2, updated_at").eq("quote_status_v2", "sent").limit(LIMIT);
  request = bindWorkspace(request, ctx.workspaceId);
  const quotes = await timed(request);
  const ids = quotes.map((quote) => quote.id);
  if (!ids.length) return { items: [], partial: false, metricVersion: METRIC_VERSION };
  let events = (ctx.supabase as any).from("quote_engagement_events").select("quote_id, event_type").in("quote_id", ids).eq("event_type", "opened");
  events = bindWorkspace(events, ctx.workspaceId);
  const opened = new Set((await timed(events)).map((event) => event.quote_id));
  return { items: quotes.filter((quote) => !opened.has(quote.id)).map((quote) => ({ ...stamp("quote", quote), view: quoteViewFact([]) })), partial: quotes.length >= LIMIT, metricVersion: METRIC_VERSION };
}

async function forecast(ctx: ReadContext) {
  const { rows, partial } = await openDeals(ctx);
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) || 0) + Math.round(row.amount * row.probability / 100));
  return { totals: [...totals.entries()].map(([currency, weightedAmount]) => ({ currency, weightedAmount })), mixedCurrenciesCombined: false, partial, metricVersion: METRIC_VERSION, asOf: new Date().toISOString() };
}
