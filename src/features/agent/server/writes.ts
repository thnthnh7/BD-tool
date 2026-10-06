import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Json } from "@/lib/database.types";
import { contactDisplayName, isRecordId, mentionedCompany, pickUniqueName, writeActionLine, writeCompletedText } from "@/features/agent/logic";
import { startMapsScrapeAction } from "@/features/leads/server/scrape-actions";
import { startActorScrapeWithInput } from "@/features/leads/server/actor-run";
import type { ReadContext } from "@/features/agent/server/read";
import { actorSecretFieldNames, readableActorFields, unsupportedActorFields, validateActorInputObject, validateActorJsonInput } from "@/features/leads/actor-input";
import { ACTOR_GUIDE_PROMPT_VERSION } from "@/features/leads/actor-guide";

export const WRITE_TOOLS = [
  { name: "create_company", tier: 2 as const },
  { name: "update_company", tier: 2 as const },
  { name: "create_contact", tier: 2 as const },
  { name: "update_contact", tier: 2 as const },
  { name: "create_lead", tier: 2 as const },
  { name: "update_lead", tier: 2 as const },
  { name: "create_deal", tier: 2 as const },
  { name: "update_deal", tier: 2 as const },
  { name: "create_task", tier: 2 as const },
  { name: "update_task", tier: 2 as const },
  { name: "complete_task", tier: 2 as const },
  { name: "cancel_task", tier: 2 as const },
  { name: "create_list", tier: 2 as const },
  { name: "add_company_to_list", tier: 2 as const },
  { name: "create_quote_draft", tier: 2 as const },
  { name: "add_note", tier: 2 as const },
  { name: "start_maps_scrape", tier: 3 as const },
  { name: "start_actor_scrape", tier: 3 as const },
  { name: "start_crm_sync", tier: 3 as const },
];

const WRITE_NAMES = new Set(WRITE_TOOLS.map((tool) => tool.name));

export function isWriteTool(name: string) {
  return WRITE_NAMES.has(name);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

export function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function text(args: Record<string, unknown>, key: string) {
  return typeof args[key] === "string" ? args[key].trim() : "";
}

function firstText(args: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => text(args, key)).find(Boolean) || "";
}

function likeTerm(value: string) {
  return `%${value.replace(/[%_\\]/g, "")}%`;
}

type ResolvedParty = { id: string; name: string; companyId: string | null };

async function resolveParty(ctx: ReadContext, kind: "company" | "contact", id: string, name: string): Promise<ResolvedParty | { error: string } | null> {
  if (!id && !name) return null;
  if (isRecordId(id)) {
    if (kind === "company") {
      const { data, error } = await ctx.supabase.from("companies").select("id, name").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
      if (error || !data) return { error: "Company was not found." };
      return { id: data.id, name: data.name, companyId: data.id };
    }
    const { data, error } = await ctx.supabase.from("contacts").select("id, display_name, company_id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (error || !data) return { error: "Contact was not found." };
    return { id: data.id, name: data.display_name, companyId: data.company_id };
  }
  const query = name || id;
  if (!query) return null;
  if (kind === "company") {
    const { data, error } = await ctx.supabase.from("companies").select("id, name").eq("workspace_id", ctx.workspaceId).ilike("name", likeTerm(query)).limit(8);
    if (error) return { error: "The company search failed." };
    const rows = (data || []).map((row) => ({ id: row.id, name: row.name }));
    const picked = pickUniqueName(query, rows);
    if (picked.match === "one") return { id: picked.item.id, name: picked.item.name, companyId: picked.item.id };
    if (picked.match === "several") return { error: `Several companies match ${query}: ${picked.items.map((item) => item.name).join(", ")}. Choose one.` };
    return { error: `No company matches ${query}.` };
  }
  const { data, error } = await ctx.supabase.from("contacts").select("id, display_name, company_id").eq("workspace_id", ctx.workspaceId).ilike("display_name", likeTerm(query)).limit(8);
  if (error) return { error: "The contact search failed." };
  const rows = (data || []).map((row) => ({ id: row.id, name: row.display_name, companyId: row.company_id }));
  const picked = pickUniqueName(query, rows);
  if (picked.match === "one") {
    const source = rows.find((row) => row.id === picked.item.id);
    return { id: picked.item.id, name: picked.item.name, companyId: source?.companyId || null };
  }
  if (picked.match === "several") return { error: `Several contacts match ${query}: ${picked.items.map((item) => item.name).join(", ")}. Choose one.` };
  return { error: `No contact matches ${query}.` };
}

async function normalizeCreateDeal(ctx: ReadContext, args: Record<string, unknown>) {
  const title = text(args, "title");
  if (!title) return { error: "Deal title is required." };
  const contactId = text(args, "contactId");
  const contactName = firstText(args, ["contactName", "contact", "customerName", "customer"]);
  const contact = await resolveParty(ctx, "contact", isRecordId(contactId) ? contactId : "", contactName || (contactId && !isRecordId(contactId) ? contactId : ""));
  if (contact && "error" in contact) return contact;
  const companyId = text(args, "companyId");
  const companyName = firstText(args, ["companyName", "company"]);
  let company = await resolveParty(ctx, "company", isRecordId(companyId) ? companyId : "", companyName || (companyId && !isRecordId(companyId) ? companyId : ""));
  if (company && "error" in company) return company;
  if (!company && contact?.companyId) {
    company = await resolveParty(ctx, "company", contact.companyId, "");
    if (company && "error" in company) return company;
  }
  if (!company) return { error: "Company is required." };
  if (contact?.companyId && contact.companyId !== company.id) return { error: `${contact.name} belongs to a different company. Choose the company before creating the deal.` };
  const payload: Record<string, unknown> = {
    title,
    companyId: company.id,
    companyName: company.name,
    currency: text(args, "currency") || "VND",
  };
  const lines = [title, company.name];
  if (contact) {
    payload.contactId = contact.id;
    payload.contactName = contact.name;
    lines.push(contact.name);
  }
  return { payload, lines };
}

async function withLabels(ctx: ReadContext, args: Record<string, unknown>) {
  const next = { ...args };
  const companyId = text(next, "companyId");
  if (!text(next, "companyName") && isRecordId(companyId)) {
    const { data } = await ctx.supabase.from("companies").select("name").eq("id", companyId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (data?.name) next.companyName = data.name;
  }
  const contactId = text(next, "contactId");
  if (!text(next, "contactName") && !text(next, "displayName") && isRecordId(contactId)) {
    const { data } = await ctx.supabase.from("contacts").select("display_name").eq("id", contactId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (data?.display_name) next.contactName = data.display_name;
  }
  const listId = text(next, "listId");
  if (!text(next, "listName") && isRecordId(listId)) {
    const { data } = await ctx.supabase.from("lead_lists").select("name").eq("id", listId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (data?.name) next.listName = data.name;
  }
  const taskId = text(next, "taskId");
  if (!text(next, "title") && isRecordId(taskId)) {
    const { data } = await ctx.supabase.from("tasks").select("title").eq("id", taskId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (data?.title) next.title = data.title;
  }
  const dealId = text(next, "dealId");
  if (!text(next, "title") && isRecordId(dealId)) {
    const { data } = await ctx.supabase.from("deals").select("title").eq("id", dealId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (data?.title) next.title = data.title;
  }
  return next;
}

async function normalizeCreateContact(ctx: ReadContext, args: Record<string, unknown>) {
  const displayName = contactDisplayName(args);
  if (!displayName) return { error: "Contact name is required." };
  const rawCompanyId = text(args, "companyId");
  const companyName = mentionedCompany(args);
  let companyId = isRecordId(rawCompanyId) ? rawCompanyId : "";
  let resolvedName = companyName;
  let createCompanyName = "";
  if (companyId) {
    const found = await resolveParty(ctx, "company", companyId, "");
    if (!found || "error" in found) return { error: found && "error" in found ? found.error : "Company was not found." };
    companyId = found.id;
    resolvedName = found.name;
  } else if (companyName) {
    const found = await resolveParty(ctx, "company", "", companyName);
    if (found && "error" in found && !found.error.startsWith("No company matches ")) return found;
    if (found && !("error" in found)) {
      companyId = found.id;
      resolvedName = found.name;
    } else {
      createCompanyName = companyName;
    }
  }
  const payload: Record<string, unknown> = { ...args, displayName, name: displayName };
  if (companyId) payload.companyId = companyId;
  if (resolvedName) payload.companyName = resolvedName;
  return { payload, createCompanyName };
}

async function prepareActorScrapeApproval(ctx: ReadContext, args: Record<string, unknown>) {
  const sourceId = text(args, "sourceId");
  const expectedHash = text(args, "contractHash");
  const rawInput = args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input as Record<string, unknown> : {};
  if (!sourceId || !expectedHash) return { error: "Actor sourceId and contractHash are required." };
  const { data: installed } = await ctx.supabase.from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (!installed) return { error: "This Actor is not installed in the workspace." };
  const { data: source, error } = await ctx.supabase.from("scrape_sources")
    .select("id, title, slug, input_schema, contract_hash, actor_build_id, actor_build_number, pricing_model, pricing_info")
    .eq("id", sourceId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !source?.input_schema || !source.contract_hash || !source.actor_build_id) return { error: "The Actor definition is unavailable." };
  if (source.contract_hash !== expectedHash) return { error: "The Actor definition changed. Load the current contract and rebuild the preview." };
  const secretNames = new Set(actorSecretFieldNames(source.input_schema));
  if (Object.keys(rawInput).some((name) => secretNames.has(name))) return { error: "Actor approvals cannot contain secret input values." };
  const unsupportedRequired = unsupportedActorFields(source.input_schema).filter((field) => field.required);
  const jsonFallback = unsupportedRequired.length > 0 && unsupportedRequired.every((field) => !["fileupload", "resourcePicker"].includes(field.editor) && !/secret/i.test(field.reason));
  if (unsupportedRequired.length && !jsonFallback) return { error: `Required Actor controls are unsupported: ${unsupportedRequired.map((field) => field.label).join(", ")}.` };
  let normalized: Record<string, unknown>;
  if (jsonFallback) {
    const validation = validateActorJsonInput(source.input_schema, rawInput);
    if (!validation.valid) return { error: validation.error || "The Actor input is invalid." };
    normalized = rawInput;
  } else {
    const validation = validateActorInputObject(readableActorFields(source.input_schema, null), rawInput);
    if ("error" in validation) return { error: validation.error || "The Actor input is invalid." };
    normalized = validation.body;
  }
  return {
    payload: {
      sourceId,
      actorTitle: source.title,
      actorSlug: source.slug,
      contractHash: source.contract_hash,
      actorBuildId: source.actor_build_id,
      actorBuildNumber: source.actor_build_number,
      normalizedInput: normalized,
      inputHash: payloadHash(normalized),
      jsonFallback,
      pricingBasis: { model: source.pricing_model, info: source.pricing_info || null, contractHash: source.contract_hash },
      guideSourceVersions: { contractHash: source.contract_hash, promptVersion: ACTOR_GUIDE_PROMPT_VERSION },
    },
  };
}

export async function proposeWrite(ctx: ReadContext, conversationId: string | null, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = WRITE_TOOLS.find((item) => item.name === name);
  if (!tool) return { error: "Unsupported action." };
  if (tool.tier === 3 && ctx.role === "member") return { error: "An owner or admin must confirm this action." };
  let priorApprovals: Record<string, unknown>[] = [];
  let prepared: { payload: Record<string, unknown> } | { error: string };
  if (name === "start_actor_scrape") prepared = await prepareActorScrapeApproval(ctx, args);
  else if (name === "create_deal") prepared = await normalizeCreateDeal(ctx, args);
  else if (name === "create_contact") {
    const normalized = await normalizeCreateContact(ctx, args);
    if ("error" in normalized) return { error: normalized.error };
    if (normalized.createCompanyName) {
      const companyCard = await proposeWrite(ctx, conversationId, "create_company", { name: normalized.createCompanyName });
      if ("error" in companyCard) return { error: String(companyCard.error) };
      priorApprovals = [companyCard];
    }
    prepared = { payload: normalized.payload };
  } else prepared = { payload: await withLabels(ctx, args) };
  if ("error" in prepared) return { error: prepared.error };
  const payload = canonical(prepared.payload) as Json;
  const lines = [writeActionLine(ctx.locale, name, prepared.payload)].filter((line) => line.length > 0);
  const hash = payloadHash(payload);
  const preview = {
    tool: name,
    tier: tool.tier,
    fields: payload,
    lines,
    undo: tool.tier === 3 ? "External effects cannot be undone from chat." : "A later undo milestone can reverse this record change.",
    cost: name === "start_maps_scrape" || name === "start_actor_scrape" ? "This starts paid Apify usage after you confirm." : null,
  };
  const existing = await ctx.supabase
    .from("agent_approvals")
    .select("id, status, expires_at, preview")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .eq("tool_name", name)
    .eq("payload_hash", hash)
    .eq("status", "waiting_for_confirmation")
    .maybeSingle();
  if (existing.data) {
    const expiresAt = existing.data.expires_at > new Date().toISOString() ? existing.data.expires_at : new Date(Date.now() + 15 * 60_000).toISOString();
    if (expiresAt !== existing.data.expires_at) {
      await ctx.supabase.from("agent_approvals").update({ expires_at: expiresAt, preview, payload, conversation_id: conversationId }).eq("id", existing.data.id).eq("workspace_id", ctx.workspaceId).eq("status", "waiting_for_confirmation");
    }
    return { approvalId: existing.data.id, status: existing.data.status, preview, expiresAt, replayed: true, ...(priorApprovals.length ? { priorApprovals } : {}) };
  }
  const { data, error } = await ctx.supabase
    .from("agent_approvals")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      conversation_id: conversationId,
      tool_name: name,
      tier: tool.tier,
      payload,
      payload_hash: hash,
      preview,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    })
    .select("id, status, preview, expires_at")
    .single();
  if (error) return { error: "The confirmation could not be saved." };
  return { approvalId: data.id, status: data.status, preview: data.preview, expiresAt: data.expires_at, ...(priorApprovals.length ? { priorApprovals } : {}) };
}

async function remember(ctx: ReadContext, tool: string, key: string, result: Json) {
  await ctx.supabase.from("agent_idempotency_keys").insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    tool_name: tool,
    idempotency_key: key,
    result,
  });
}

async function rememberConfirmation(ctx: ReadContext, conversationId: string | null, content: string) {
  if (!conversationId) return;
  await ctx.supabase.from("agent_messages").insert({
    conversation_id: conversationId,
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    role: "assistant",
    content,
    status: "complete",
    blocks: [{ type: "answer", text: content }],
  });
}

async function replay(ctx: ReadContext, tool: string, key: string) {
  const { data } = await ctx.supabase
    .from("agent_idempotency_keys")
    .select("result")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .eq("tool_name", tool)
    .eq("idempotency_key", key)
    .maybeSingle();
  return data?.result || null;
}

export async function executeApprovedWrite(ctx: ReadContext, approvalId: string) {
  const { data: approval, error } = await ctx.supabase
    .from("agent_approvals")
    .select("id, conversation_id, tool_name, tier, payload, payload_hash, status, expires_at")
    .eq("id", approvalId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error || !approval) return { error: "Confirmation not found." };
  if (approval.expires_at <= new Date().toISOString() || approval.status === "expired") {
    await ctx.supabase.from("agent_approvals").update({ status: "expired" }).eq("id", approval.id).eq("workspace_id", ctx.workspaceId);
    return { error: "This confirmation expired. Ask again so the preview can be rebuilt." };
  }
  if (payloadHash(approval.payload) !== approval.payload_hash) {
    await ctx.supabase.from("agent_approvals").update({ status: "expired" }).eq("id", approval.id).eq("workspace_id", ctx.workspaceId);
    return { error: "The proposed data changed. Confirmation was invalidated." };
  }
  if (approval.status !== "waiting_for_confirmation" && approval.status !== "failed") return { error: "This confirmation is no longer waiting." };
  if (approval.tier === 3 && ctx.role === "member") return { error: "An owner or admin must confirm this action." };
  const payload = approval.payload as Record<string, unknown>;
  const message = writeCompletedText(ctx.locale, approval.tool_name, text(payload, "title") || text(payload, "displayName") || text(payload, "name"));
  const prior = await replay(ctx, approval.tool_name, approval.payload_hash);
  if (prior) {
    await ctx.supabase.from("agent_approvals").update({ status: "completed", result: prior as Json }).eq("id", approval.id).eq("workspace_id", ctx.workspaceId);
    await rememberConfirmation(ctx, approval.conversation_id, message);
    return { result: prior, replayed: true, message };
  }
  await ctx.supabase.from("agent_approvals").update({ status: "running" }).eq("id", approval.id).in("status", ["waiting_for_confirmation", "failed"]).eq("workspace_id", ctx.workspaceId);
  try {
    const result = await runWrite(ctx, approval.tool_name, payload);
    await remember(ctx, approval.tool_name, approval.payload_hash, result as Json);
    await ctx.supabase.from("agent_approvals").update({ status: "completed", result: result as Json }).eq("id", approval.id).eq("workspace_id", ctx.workspaceId);
    await rememberConfirmation(ctx, approval.conversation_id, message);
    return { result, message };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The action failed.";
    await ctx.supabase.from("agent_approvals").update({ status: "failed", result: { message } }).eq("id", approval.id).eq("workspace_id", ctx.workspaceId);
    return { error: message };
  }
}

async function insertCompany(ctx: ReadContext, args: Record<string, unknown>) {
  const companyName = text(args, "name") || text(args, "companyName");
  if (!companyName) throw new Error("Company name is required.");
  const { data, error } = await ctx.supabase.from("companies").insert({ workspace_id: ctx.workspaceId, name: companyName, website: text(args, "website"), industry: text(args, "industry"), email: text(args, "email"), phone: text(args, "phone"), notes: text(args, "notes"), owner_user_id: ctx.userId }).select("id, name").single();
  if (error || !data) throw new Error("Company was not created.");
  return { id: data.id, href: `/app/companies/${data.id}` };
}

async function runWrite(ctx: ReadContext, name: string, args: Record<string, unknown>) {
  if (name === "create_company") return insertCompany(ctx, args);
  if (name === "update_company") return updateRecord(ctx, "companies", text(args, "companyId"), { name: text(args, "name"), website: text(args, "website"), industry: text(args, "industry"), notes: text(args, "notes") }, "companies");
  if (name === "create_contact") {
    const displayName = contactDisplayName(args);
    if (!displayName) throw new Error("Contact name is required.");
    let companyId = text(args, "companyId");
    const companyName = mentionedCompany(args);
    if (!isRecordId(companyId) && companyName) {
      const found = await resolveParty(ctx, "company", "", companyName);
      if (found && "error" in found && !found.error.startsWith("No company matches ")) throw new Error(found.error);
      companyId = found && !("error" in found) ? found.id : (await insertCompany(ctx, { name: companyName })).id;
    }
    const { data, error } = await ctx.supabase.from("contacts").insert({ workspace_id: ctx.workspaceId, display_name: displayName, first_name: text(args, "firstName"), last_name: text(args, "lastName"), email: text(args, "email"), phone: text(args, "phone"), job_title: text(args, "jobTitle"), linkedin_url: text(args, "linkedinUrl"), company_id: isRecordId(companyId) ? companyId : null, notes: text(args, "notes"), owner_user_id: ctx.userId }).select("id").single();
    if (error) throw new Error("Contact was not created.");
    return { id: data.id, href: `/app/contacts/${data.id}` };
  }
  if (name === "update_contact") return updateRecord(ctx, "contacts", text(args, "contactId"), { display_name: text(args, "displayName"), email: text(args, "email"), phone: text(args, "phone"), job_title: text(args, "jobTitle") }, "contacts");
  if (name === "create_lead") {
    const { data, error } = await ctx.supabase.from("leads").insert({ workspace_id: ctx.workspaceId, company_id: text(args, "companyId") || null, contact_id: text(args, "contactId") || null, source: text(args, "source") || "agent", owner_user_id: ctx.userId }).select("id").single();
    if (error) throw new Error("Lead was not created.");
    return { id: data.id, href: `/app/leads/${data.id}` };
  }
  if (name === "update_lead") return updateRecord(ctx, "leads", text(args, "leadId"), { status: text(args, "status"), source: text(args, "source") }, "leads");
  if (name === "create_deal") {
    const normalized = await normalizeCreateDeal(ctx, args);
    if ("error" in normalized) throw new Error(normalized.error);
    return createDeal(ctx, normalized.payload);
  }
  if (name === "update_deal") return updateRecord(ctx, "deals", text(args, "dealId"), { title: text(args, "title"), priority: text(args, "priority") }, "deals");
  if (name === "create_task") {
    const title = text(args, "title");
    if (!title) throw new Error("Task title is required.");
    const { data, error } = await ctx.supabase.from("tasks").insert({ workspace_id: ctx.workspaceId, title, description: text(args, "description"), due_at: text(args, "dueAt") || null, company_id: text(args, "companyId") || null, contact_id: text(args, "contactId") || null, deal_id: text(args, "dealId") || null, assigned_to: ctx.userId, created_by: ctx.userId }).select("id").single();
    if (error) throw new Error("Task was not created.");
    return { id: data.id, href: "/app/tasks" };
  }
  if (name === "update_task") return updateRecord(ctx, "tasks", text(args, "taskId"), { title: text(args, "title"), description: text(args, "description") }, "tasks");
  if (name === "complete_task") return updateRecord(ctx, "tasks", text(args, "taskId"), { status: "completed", completed_at: new Date().toISOString() }, "tasks");
  if (name === "cancel_task") return updateRecord(ctx, "tasks", text(args, "taskId"), { status: "canceled" }, "tasks");
  if (name === "create_list") {
    const listName = text(args, "name");
    if (!listName) throw new Error("List name is required.");
    const { data, error } = await ctx.supabase.from("lead_lists").insert({ workspace_id: ctx.workspaceId, name: listName, description: text(args, "description"), owner_user_id: ctx.userId }).select("id").single();
    if (error) throw new Error("List was not created.");
    return { id: data.id, href: `/app/lists/${data.id}` };
  }
  if (name === "add_company_to_list") {
    const { error } = await ctx.supabase.from("lead_list_members").insert({ workspace_id: ctx.workspaceId, list_id: text(args, "listId"), company_id: text(args, "companyId") });
    if (error) throw new Error("The company was not added to the list.");
    return { href: `/app/lists/${text(args, "listId")}` };
  }
  if (name === "create_quote_draft") {
    const title = text(args, "title");
    if (!title) throw new Error("Quote title is required.");
    const { data, error } = await ctx.supabase.from("quotes").insert({ workspace_id: ctx.workspaceId, public_id: `ag-${randomUUID().slice(0, 8)}`, title, project_type: text(args, "projectType") || "Custom project", currency: text(args, "currency") || "VND", quote_status_v2: "draft", status: "draft", deal_id: text(args, "dealId") || null }).select("id, revision_number").single();
    if (error) throw new Error("Quote draft was not created.");
    return { id: data.id, revision: data.revision_number, href: `/app/quotes/${data.id}`, sent: false };
  }
  if (name === "add_note") {
    const title = text(args, "title") || "Note";
    const { data, error } = await ctx.supabase.from("activities").insert({ workspace_id: ctx.workspaceId, actor_user_id: ctx.userId, activity_type: "note", title, body: text(args, "body"), company_id: text(args, "companyId") || null, contact_id: text(args, "contactId") || null, deal_id: text(args, "dealId") || null }).select("id").single();
    if (error) throw new Error("Note was not saved.");
    return { id: data.id };
  }
  if (name === "start_maps_scrape") {
    const form = new FormData();
    form.set("query", text(args, "query"));
    form.set("location", text(args, "location"));
    form.set("language", text(args, "language") || "en");
    form.set("max_results", String(args.maxResults || 20));
    form.set("pdpa_confirmed", "on");
    const scrape = await startMapsScrapeAction(form);
    if ("error" in scrape && scrape.error) throw new Error(scrape.error);
    if (!("id" in scrape)) throw new Error("Scrape was not started.");
    return { id: scrape.id, href: `/app/leads/scrape/${scrape.id}` };
  }
  if (name === "start_actor_scrape") {
    const normalizedInput = args.normalizedInput && typeof args.normalizedInput === "object" && !Array.isArray(args.normalizedInput)
      ? args.normalizedInput as Record<string, unknown>
      : {};
    const scrape = await startActorScrapeWithInput({
      sourceId: text(args, "sourceId"),
      contractHash: text(args, "contractHash"),
      actorBuildId: text(args, "actorBuildId"),
      normalizedInput,
      pricingBasis: (args.pricingBasis || {}) as Json,
      guideSourceVersions: (args.guideSourceVersions || {}) as Json,
      jsonFallback: args.jsonFallback === true,
    });
    if ("error" in scrape && scrape.error) throw new Error(scrape.error);
    if (!("id" in scrape)) throw new Error("Actor run was not started.");
    return { id: scrape.id, href: `/app/leads/scrape/${scrape.id}` };
  }
  if (name === "start_crm_sync") {
    const connectionId = text(args, "connectionId");
    const { data: connection, error } = await ctx.supabase.from("crm_connections").select("id, provider, status, sync_direction, sync_objects").eq("id", connectionId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (error || !connection || connection.provider !== "hubspot" || connection.status !== "connected") throw new Error("An active HubSpot connection is required.");
    if (!["import", "bidirectional"].includes(connection.sync_direction)) throw new Error("This CRM connection does not allow imports.");
    const requested = Array.isArray(args.objects) ? args.objects.map(String) : connection.sync_objects;
    const objects = requested.filter((objectType) => connection.sync_objects.includes(objectType));
    if (!objects.length) throw new Error("No configured CRM objects were selected.");
    const { data, error: insertError } = await ctx.supabase.from("crm_sync_runs").insert({ workspace_id: ctx.workspaceId, connection_id: connectionId, direction: "import", status: "queued", sync_objects: objects, requested_by: ctx.userId }).select("id, status").single();
    if (insertError) throw new Error("CRM sync was not queued.");
    return { id: data.id, href: "/app/crm-integrations" };
  }
  throw new Error("Unsupported action.");
}

async function updateRecord(ctx: ReadContext, table: "companies" | "contacts" | "leads" | "deals" | "tasks", id: string, patch: Record<string, string | null>, hrefType: string) {
  if (!id) throw new Error("Record id is required.");
  const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value));
  const { data, error } = await ctx.supabase.from(table).update(changes as never).eq("id", id).eq("workspace_id", ctx.workspaceId).select("id").maybeSingle();
  if (error || !data) throw new Error("Record was not updated.");
  return { id: data.id, href: hrefType === "tasks" ? "/app/tasks" : `/app/${hrefType}/${data.id}` };
}

async function createDeal(ctx: ReadContext, args: Record<string, unknown>) {
  const title = text(args, "title");
  const companyId = text(args, "companyId");
  const contactId = text(args, "contactId");
  if (!title || !isRecordId(companyId)) throw new Error("Deal title and company are required.");
  const { data: pipeline } = await ctx.supabase.from("pipelines").select("id").eq("workspace_id", ctx.workspaceId).order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!pipeline) throw new Error("No sales pipeline is available.");
  const { data: stage } = await ctx.supabase.from("pipeline_stages").select("id").eq("workspace_id", ctx.workspaceId).eq("pipeline_id", pipeline.id).eq("stage_type", "open").order("position").limit(1).maybeSingle();
  if (!stage) throw new Error("No open pipeline stage is available.");
  const primaryContactId = isRecordId(contactId) ? contactId : null;
  const { data, error } = await ctx.supabase.from("deals").insert({ workspace_id: ctx.workspaceId, company_id: companyId, primary_contact_id: primaryContactId, pipeline_id: pipeline.id, stage_id: stage.id, title, owner_user_id: ctx.userId, currency: text(args, "currency") || "VND" }).select("id").single();
  if (error || !data) throw new Error(error?.message || "Deal was not created.");
  if (primaryContactId) {
    await ctx.supabase.from("deal_contacts").insert({ workspace_id: ctx.workspaceId, deal_id: data.id, contact_id: primaryContactId, stakeholder_role: "other", is_primary: true });
  }
  return { id: data.id, href: `/app/deals/${data.id}`, title };
}
