import "server-only";

import { getCrmConnectionAccessToken } from "@/features/crm-integrations/server/oauth";
import { applyImportMappings, resolveImportConflict, type ConflictPolicy, type FieldMapping } from "@/features/crm-integrations/server/sync-logic";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type HubSpotObject = "companies" | "contacts" | "deals";
type HubSpotRecord = { id: string; properties: Record<string, string | null>; createdAt: string; updatedAt: string; archived?: boolean; associations?: Record<string, { results?: Array<{ id: string }> }> };
type HubSpotPage = { results?: HubSpotRecord[]; paging?: { next?: { after?: string } }; message?: string };
type QueueRun = { id: string; workspace_id: string; connection_id: string; sync_objects: string[]; cursor_state: Json; records_read: number; records_created: number; records_updated: number; records_skipped: number; records_failed: number; attempt_count: number; cancel_requested: boolean };

const supportedObjects: HubSpotObject[] = ["companies", "contacts", "deals"];
const properties: Record<HubSpotObject, string[]> = {
  companies: ["name", "domain", "website", "industry", "numberofemployees", "phone", "address", "city", "state", "zip", "country"],
  contacts: ["firstname", "lastname", "email", "phone", "jobtitle", "hs_linkedin_url"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate", "description", "hs_deal_stage_probability"],
};

function objectCursor(value: Json): { objectIndex: number; after?: string; recordId?: string; failureId?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { objectIndex: 0 };
  return { objectIndex: Number(value.objectIndex || 0), after: typeof value.after === "string" ? value.after : undefined, recordId: typeof value.recordId === "string" ? value.recordId : undefined, failureId: typeof value.failureId === "string" ? value.failureId : undefined };
}

async function hubspotPage(token: string, objectType: HubSpotObject, extraProperties: string[], after?: string) {
  const url = new URL(`https://api.hubapi.com/crm/v3/objects/${objectType}`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("archived", "false");
  const requestedProperties = [...new Set([
    ...properties[objectType],
    ...extraProperties.filter((property) => /^[a-zA-Z0-9_]+$/.test(property)),
  ])];
  url.searchParams.set("properties", requestedProperties.join(","));
  if (objectType === "deals") url.searchParams.set("associations", "companies,contacts");
  if (after) url.searchParams.set("after", after);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const payload = await response.json().catch(() => ({})) as HubSpotPage;
    if (response.ok) return payload;
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Math.min(Number(response.headers.get("retry-after") || 2 ** attempt), 15);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    throw new Error(`HubSpot ${objectType} request failed (${response.status}): ${payload.message || "Unknown provider error"}`);
  }
  throw new Error("HubSpot request retry limit reached.");
}

async function hubspotRecord(token: string, objectType: HubSpotObject, recordId: string, extraProperties: string[]) {
  const url = new URL(`https://api.hubapi.com/crm/v3/objects/${objectType}/${encodeURIComponent(recordId)}`);
  url.searchParams.set("archived", "false");
  url.searchParams.set("properties", [...new Set([...properties[objectType], ...extraProperties.filter((property) => /^[a-zA-Z0-9_]+$/.test(property))])].join(","));
  if (objectType === "deals") url.searchParams.set("associations", "companies,contacts");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const payload = await response.json().catch(() => ({})) as HubSpotRecord & { message?: string };
  if (!response.ok) throw new Error(`HubSpot ${objectType} record request failed (${response.status}): ${payload.message || "Unknown provider error"}`);
  return payload;
}

async function recordFailure(run: QueueRun, objectType: HubSpotObject, record: HubSpotRecord, error: unknown) {
  const admin = createAdminClient();
  const message = error instanceof Error ? error.message : "CRM record import failed.";
  const { data: existing } = await admin.from("crm_sync_record_failures").select("attempt_count").eq("connection_id", run.connection_id).eq("object_type", objectType).eq("external_record_id", record.id).maybeSingle();
  await admin.from("crm_sync_record_failures").upsert({ workspace_id: run.workspace_id, connection_id: run.connection_id, run_id: run.id, object_type: objectType, external_record_id: record.id, error_message: message.slice(0, 2000), record_snapshot: record as unknown as Json, status: "open", attempt_count: (existing?.attempt_count || 0) + 1, last_attempt_at: new Date().toISOString(), resolved_at: null }, { onConflict: "connection_id,object_type,external_record_id" });
}

async function importRecord(run: QueueRun, objectType: HubSpotObject, record: HubSpotRecord, conflictPolicy: ConflictPolicy, mappings: FieldMapping[]) {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("crm_record_links").select("leadely_record_id, last_synced_at, conflict_resolution").eq("workspace_id", run.workspace_id).eq("connection_id", run.connection_id).eq("object_type", objectType).eq("external_record_id", record.id).maybeSingle();
  if (linkError) throw linkError;
  let localId = link?.leadely_record_id;
  let created = false;
  if (localId && link) {
    const local = objectType === "companies"
      ? await admin.from("companies").select("updated_at").eq("id", localId).eq("workspace_id", run.workspace_id).maybeSingle()
      : objectType === "contacts"
        ? await admin.from("contacts").select("updated_at").eq("id", localId).eq("workspace_id", run.workspace_id).maybeSingle()
        : await admin.from("deals").select("updated_at").eq("id", localId).eq("workspace_id", run.workspace_id).maybeSingle();
    if (local.error) throw local.error;
    if (link.conflict_resolution !== "use_external" && resolveImportConflict(conflictPolicy, link.last_synced_at, local.data?.updated_at || null, record.updatedAt) === "preserve_local") {
      const { error } = await admin.from("crm_record_links").update({ sync_status: "conflict", external_updated_at: record.updatedAt, external_snapshot: record as unknown as Json, conflict_resolution: null, last_error: `Both systems changed after ${link.last_synced_at}; local record preserved by ${conflictPolicy}.` }).eq("connection_id", run.connection_id).eq("object_type", objectType).eq("external_record_id", record.id);
      if (error) throw error;
      return "skipped" as const;
    }
  }
  if (objectType === "companies") {
    const company = applyImportMappings(objectType, { name: record.properties.name || record.properties.domain || `HubSpot company ${record.id}`, domain: record.properties.domain || "", website: record.properties.website || "", industry: record.properties.industry || "", company_size: record.properties.numberofemployees || "", phone: record.properties.phone || "", address: [record.properties.address, record.properties.city, record.properties.state, record.properties.zip, record.properties.country].filter(Boolean).join(", "), lead_source: "HubSpot" }, record.properties, mappings);
    if (!localId && company.domain) localId = (await admin.from("companies").select("id").eq("workspace_id", run.workspace_id).eq("domain", company.domain).limit(1).maybeSingle()).data?.id;
    if (localId) { const { error } = await admin.from("companies").update(company).eq("id", localId).eq("workspace_id", run.workspace_id); if (error) throw error; }
    else { const { data, error } = await admin.from("companies").insert({ workspace_id: run.workspace_id, ...company }).select("id").single(); if (error) throw error; localId = data.id; created = true; }
  } else if (objectType === "contacts") {
    const contact = applyImportMappings(objectType, { first_name: record.properties.firstname || "", last_name: record.properties.lastname || "", display_name: [record.properties.firstname, record.properties.lastname].filter(Boolean).join(" ") || record.properties.email || `HubSpot contact ${record.id}`, email: record.properties.email || "", phone: record.properties.phone || "", job_title: record.properties.jobtitle || "", linkedin_url: record.properties.hs_linkedin_url || "", notes: "Imported from HubSpot" }, record.properties, mappings);
    if (!localId && contact.email) localId = (await admin.from("contacts").select("id").eq("workspace_id", run.workspace_id).eq("email", contact.email).limit(1).maybeSingle()).data?.id;
    if (localId) { const { error } = await admin.from("contacts").update(contact).eq("id", localId).eq("workspace_id", run.workspace_id); if (error) throw error; }
    else { const { data, error } = await admin.from("contacts").insert({ workspace_id: run.workspace_id, ...contact }).select("id").single(); if (error) throw error; localId = data.id; created = true; }
  } else {
    const externalCompanyId = record.associations?.companies?.results?.[0]?.id;
    if (!externalCompanyId) throw new Error(`HubSpot deal ${record.id} has no associated company.`);
    const { data: companyLink, error: companyLinkError } = await admin.from("crm_record_links").select("leadely_record_id").eq("workspace_id", run.workspace_id).eq("connection_id", run.connection_id).eq("object_type", "companies").eq("external_record_id", externalCompanyId).maybeSingle();
    if (companyLinkError) throw companyLinkError;
    if (!companyLink) throw new Error(`Import companies before deal ${record.id}.`);
    const externalContactId = record.associations?.contacts?.results?.[0]?.id;
    const contactLink = externalContactId ? (await admin.from("crm_record_links").select("leadely_record_id").eq("workspace_id", run.workspace_id).eq("connection_id", run.connection_id).eq("object_type", "contacts").eq("external_record_id", externalContactId).maybeSingle()).data : null;
    const { data: pipeline } = await admin.from("pipelines").select("id").eq("workspace_id", run.workspace_id).order("is_default", { ascending: false }).order("created_at").limit(1).maybeSingle();
    if (!pipeline) throw new Error("Create a Bizcraw sales pipeline before importing deals.");
    const { data: stage } = await admin.from("pipeline_stages").select("id, probability").eq("workspace_id", run.workspace_id).eq("pipeline_id", pipeline.id).eq("stage_type", "open").order("position").limit(1).maybeSingle();
    if (!stage) throw new Error("Create an open Bizcraw pipeline stage before importing deals.");
    const parsedAmount = Math.round(Number(record.properties.amount || 0));
    const closeDate = record.properties.closedate ? new Date(record.properties.closedate) : null;
    const deal = applyImportMappings(objectType, { company_id: companyLink.leadely_record_id, primary_contact_id: contactLink?.leadely_record_id || null, pipeline_id: pipeline.id, stage_id: stage.id, title: record.properties.dealname || `HubSpot deal ${record.id}`, description: record.properties.description || "", amount: Number.isFinite(parsedAmount) ? parsedAmount : 0, currency: "USD", probability: Math.max(0, Math.min(100, Math.round(Number(record.properties.hs_deal_stage_probability || stage.probability * 0.01) * 100))), expected_close_date: closeDate && !Number.isNaN(closeDate.getTime()) ? closeDate.toISOString().slice(0, 10) : null, source: "HubSpot" }, record.properties, mappings);
    if (localId) { const { error } = await admin.from("deals").update(deal).eq("id", localId).eq("workspace_id", run.workspace_id); if (error) throw error; }
    else { const { data, error } = await admin.from("deals").insert({ workspace_id: run.workspace_id, ...deal }).select("id").single(); if (error) throw error; localId = data.id; created = true; }
    if (contactLink?.leadely_record_id && localId) {
      const { error: clearPrimaryError } = await admin.from("deal_contacts").update({ is_primary: false }).eq("workspace_id", run.workspace_id).eq("deal_id", localId).eq("is_primary", true);
      if (clearPrimaryError) throw clearPrimaryError;
      const { error: associationError } = await admin.from("deal_contacts").upsert({ workspace_id: run.workspace_id, deal_id: localId, contact_id: contactLink.leadely_record_id, is_primary: true }, { onConflict: "deal_id,contact_id" });
      if (associationError) throw associationError;
    }
  }
  const syncedAt = new Date().toISOString();
  const { error: linkUpsertError } = await admin.from("crm_record_links").upsert({ workspace_id: run.workspace_id, connection_id: run.connection_id, object_type: objectType, leadely_record_id: localId!, external_record_id: record.id, external_updated_at: record.updatedAt, leadely_updated_at: syncedAt, last_synced_at: syncedAt, sync_status: "synced", conflict_resolution: null, external_snapshot: null, last_error: null }, { onConflict: "connection_id,object_type,external_record_id" });
  if (linkUpsertError) throw linkUpsertError;
  await admin.from("crm_sync_record_failures").update({ status: "resolved", resolved_at: syncedAt }).eq("connection_id", run.connection_id).eq("object_type", objectType).eq("external_record_id", record.id).neq("status", "resolved");
  return created ? "created" as const : "updated" as const;
}

export async function processNextHubSpotSyncPage() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_next_crm_sync_run");
  if (error) throw error;
  const run = data?.[0] as QueueRun | undefined;
  if (!run) return null;
  const { data: featureEnabled, error: featureError } = await admin.rpc("workspace_feature_enabled", {
    p_workspace_id: run.workspace_id,
    p_feature: "crm_integrations",
  });
  if (featureError) throw featureError;
  if (!featureEnabled) {
    await admin.from("crm_sync_runs").update({ status: "canceled", error_summary: "CRM integrations are not available for this workspace.", completed_at: new Date().toISOString() }).eq("id", run.id);
    return { runId: run.id, status: "canceled" };
  }
  if (run.cancel_requested) {
    await admin.from("crm_sync_runs").update({ status: "canceled", completed_at: new Date().toISOString() }).eq("id", run.id);
    return { runId: run.id, status: "canceled" };
  }
  try {
    const selected = run.sync_objects.filter((item): item is HubSpotObject => supportedObjects.includes(item as HubSpotObject));
    const cursor = objectCursor(run.cursor_state);
    const objectType = selected[cursor.objectIndex];
    if (!objectType) {
      await admin.from("crm_sync_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
      return { runId: run.id, status: "completed" };
    }
    const [{ data: crmConnection, error: connectionError }, { data: mappings, error: mappingError }] = await Promise.all([
      admin.from("crm_connections").select("conflict_policy").eq("id", run.connection_id).eq("workspace_id", run.workspace_id).single(),
      admin.from("crm_field_mappings").select("leadely_field, external_field, sync_direction, transformation, required").eq("connection_id", run.connection_id).eq("workspace_id", run.workspace_id).eq("object_type", objectType),
    ]);
    if (connectionError) throw connectionError;
    if (mappingError) throw mappingError;
    const token = await getCrmConnectionAccessToken(run.connection_id);
    const page = cursor.recordId
      ? { results: [await hubspotRecord(token, objectType, cursor.recordId, mappings.map((mapping) => mapping.external_field))] }
      : await hubspotPage(token, objectType, mappings.map((mapping) => mapping.external_field), cursor.after);
    let created = 0; let updated = 0; let skipped = 0; let failed = 0;
    for (const record of page.results || []) {
      try { const outcome = await importRecord(run, objectType, record, crmConnection.conflict_policy as ConflictPolicy, mappings); if (outcome === "created") created += 1; else if (outcome === "updated") updated += 1; else skipped += 1; }
      catch (error) { failed += 1; await recordFailure(run, objectType, record, error); }
    }
    const { data: currentRun } = await admin.from("crm_sync_runs").select("cancel_requested").eq("id", run.id).single();
    const nextAfter = page.paging?.next?.after;
    const finished = Boolean(cursor.recordId) || (!nextAfter && cursor.objectIndex + 1 >= selected.length);
    const nextCursor = nextAfter ? { objectIndex: cursor.objectIndex, after: nextAfter } : { objectIndex: cursor.objectIndex + 1 };
    const canceled = Boolean(currentRun?.cancel_requested);
    const nextStatus = canceled ? "canceled" : finished ? (failed ? "partial" : "completed") : "queued";
    await admin.from("crm_sync_runs").update({ status: nextStatus, cursor_state: nextCursor, records_read: run.records_read + (page.results?.length || 0), records_created: run.records_created + created, records_updated: run.records_updated + updated, records_skipped: run.records_skipped + skipped, records_failed: run.records_failed + failed, next_attempt_at: new Date().toISOString(), completed_at: canceled || finished ? new Date().toISOString() : null }).eq("id", run.id);
    if (finished && !canceled) await admin.from("crm_connections").update({ last_synced_at: new Date().toISOString(), last_full_sync_at: new Date().toISOString(), last_error: failed ? `${failed} record(s) failed.` : null, setup_step: "active" }).eq("id", run.connection_id).eq("workspace_id", run.workspace_id);
    return { runId: run.id, status: nextStatus, objectType, read: page.results?.length || 0, created, updated, skipped, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "HubSpot synchronization failed.";
    const retry = run.attempt_count < 4;
    await admin.from("crm_sync_runs").update({ status: retry ? "queued" : "dead_letter", error_summary: message.slice(0, 1000), next_attempt_at: new Date(Date.now() + Math.min(2 ** run.attempt_count, 30) * 60_000).toISOString(), completed_at: retry ? null : new Date().toISOString() }).eq("id", run.id);
    await admin.from("crm_connections").update({ last_error: message.slice(0, 1000) }).eq("id", run.connection_id).eq("workspace_id", run.workspace_id);
    return { runId: run.id, status: retry ? "queued" : "dead_letter", error: message };
  }
}
