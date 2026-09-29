import "server-only";

import { getCrmConnectionAccessToken } from "@/features/crm-integrations/server/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type HubSpotObject = "companies" | "contacts" | "deals";
type HubSpotRecord = { id: string; properties: Record<string, string | null>; createdAt: string; updatedAt: string; archived?: boolean; associations?: Record<string, { results?: Array<{ id: string }> }> };
type HubSpotPage = { results?: HubSpotRecord[]; paging?: { next?: { after?: string } }; message?: string };
type QueueRun = { id: string; workspace_id: string; connection_id: string; sync_objects: string[]; cursor_state: Json; records_read: number; records_created: number; records_updated: number; records_skipped: number; records_failed: number; attempt_count: number };

const supportedObjects: HubSpotObject[] = ["companies", "contacts", "deals"];
const properties: Record<HubSpotObject, string[]> = {
  companies: ["name", "domain", "website", "industry", "numberofemployees", "phone", "address", "city", "state", "zip", "country"],
  contacts: ["firstname", "lastname", "email", "phone", "jobtitle", "hs_linkedin_url"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate", "description", "hs_deal_stage_probability"],
};

function objectCursor(value: Json): { objectIndex: number; after?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { objectIndex: 0 };
  return { objectIndex: Number(value.objectIndex || 0), after: typeof value.after === "string" ? value.after : undefined };
}

async function hubspotPage(token: string, objectType: HubSpotObject, after?: string) {
  const url = new URL(`https://api.hubapi.com/crm/v3/objects/${objectType}`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("archived", "false");
  url.searchParams.set("properties", properties[objectType].join(","));
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

async function importRecord(run: QueueRun, objectType: HubSpotObject, record: HubSpotRecord) {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("crm_record_links").select("leadely_record_id").eq("workspace_id", run.workspace_id).eq("connection_id", run.connection_id).eq("object_type", objectType).eq("external_record_id", record.id).maybeSingle();
  if (linkError) throw linkError;
  let localId = link?.leadely_record_id;
  let created = false;
  if (objectType === "companies") {
    const company = { name: record.properties.name || record.properties.domain || `HubSpot company ${record.id}`, domain: record.properties.domain || "", website: record.properties.website || "", industry: record.properties.industry || "", company_size: record.properties.numberofemployees || "", phone: record.properties.phone || "", address: [record.properties.address, record.properties.city, record.properties.state, record.properties.zip, record.properties.country].filter(Boolean).join(", "), lead_source: "HubSpot" };
    if (!localId && company.domain) localId = (await admin.from("companies").select("id").eq("workspace_id", run.workspace_id).eq("domain", company.domain).limit(1).maybeSingle()).data?.id;
    if (localId) { const { error } = await admin.from("companies").update(company).eq("id", localId).eq("workspace_id", run.workspace_id); if (error) throw error; }
    else { const { data, error } = await admin.from("companies").insert({ workspace_id: run.workspace_id, ...company }).select("id").single(); if (error) throw error; localId = data.id; created = true; }
  } else if (objectType === "contacts") {
    const contact = { first_name: record.properties.firstname || "", last_name: record.properties.lastname || "", display_name: [record.properties.firstname, record.properties.lastname].filter(Boolean).join(" ") || record.properties.email || `HubSpot contact ${record.id}`, email: record.properties.email || "", phone: record.properties.phone || "", job_title: record.properties.jobtitle || "", linkedin_url: record.properties.hs_linkedin_url || "", notes: "Imported from HubSpot" };
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
    if (!pipeline) throw new Error("Create a Leadely sales pipeline before importing deals.");
    const { data: stage } = await admin.from("pipeline_stages").select("id, probability").eq("workspace_id", run.workspace_id).eq("pipeline_id", pipeline.id).eq("stage_type", "open").order("position").limit(1).maybeSingle();
    if (!stage) throw new Error("Create an open Leadely pipeline stage before importing deals.");
    const parsedAmount = Math.round(Number(record.properties.amount || 0));
    const closeDate = record.properties.closedate ? new Date(record.properties.closedate) : null;
    const deal = { company_id: companyLink.leadely_record_id, primary_contact_id: contactLink?.leadely_record_id || null, pipeline_id: pipeline.id, stage_id: stage.id, title: record.properties.dealname || `HubSpot deal ${record.id}`, description: record.properties.description || "", amount: Number.isFinite(parsedAmount) ? parsedAmount : 0, currency: "USD", probability: Math.max(0, Math.min(100, Math.round(Number(record.properties.hs_deal_stage_probability || stage.probability * 0.01) * 100))), expected_close_date: closeDate && !Number.isNaN(closeDate.getTime()) ? closeDate.toISOString().slice(0, 10) : null, source: "HubSpot" };
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
  const { error: linkUpsertError } = await admin.from("crm_record_links").upsert({ workspace_id: run.workspace_id, connection_id: run.connection_id, object_type: objectType, leadely_record_id: localId!, external_record_id: record.id, external_updated_at: record.updatedAt, leadely_updated_at: syncedAt, last_synced_at: syncedAt, sync_status: "synced", last_error: null }, { onConflict: "connection_id,object_type,external_record_id" });
  if (linkUpsertError) throw linkUpsertError;
  return created;
}

export async function processNextHubSpotSyncPage() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_next_crm_sync_run");
  if (error) throw error;
  const run = data?.[0] as QueueRun | undefined;
  if (!run) return null;
  try {
    const selected = run.sync_objects.filter((item): item is HubSpotObject => supportedObjects.includes(item as HubSpotObject));
    const cursor = objectCursor(run.cursor_state);
    const objectType = selected[cursor.objectIndex];
    if (!objectType) {
      await admin.from("crm_sync_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
      return { runId: run.id, status: "completed" };
    }
    const token = await getCrmConnectionAccessToken(run.connection_id);
    const page = await hubspotPage(token, objectType, cursor.after);
    let created = 0; let updated = 0; let failed = 0;
    for (const record of page.results || []) {
      try { if (await importRecord(run, objectType, record)) created += 1; else updated += 1; }
      catch { failed += 1; }
    }
    const nextAfter = page.paging?.next?.after;
    const finished = !nextAfter && cursor.objectIndex + 1 >= selected.length;
    const nextCursor = nextAfter ? { objectIndex: cursor.objectIndex, after: nextAfter } : { objectIndex: cursor.objectIndex + 1 };
    await admin.from("crm_sync_runs").update({ status: finished ? (failed ? "partial" : "completed") : "queued", cursor_state: nextCursor, records_read: run.records_read + (page.results?.length || 0), records_created: run.records_created + created, records_updated: run.records_updated + updated, records_failed: run.records_failed + failed, next_attempt_at: new Date().toISOString(), completed_at: finished ? new Date().toISOString() : null }).eq("id", run.id);
    if (finished) await admin.from("crm_connections").update({ last_synced_at: new Date().toISOString(), last_full_sync_at: new Date().toISOString(), last_error: failed ? `${failed} record(s) failed.` : null, setup_step: "active" }).eq("id", run.connection_id).eq("workspace_id", run.workspace_id);
    return { runId: run.id, status: finished ? (failed ? "partial" : "completed") : "queued", objectType, read: page.results?.length || 0, created, updated, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "HubSpot synchronization failed.";
    const retry = run.attempt_count < 4;
    await admin.from("crm_sync_runs").update({ status: retry ? "queued" : "failed", error_summary: message.slice(0, 1000), next_attempt_at: new Date(Date.now() + Math.min(2 ** run.attempt_count, 30) * 60_000).toISOString(), completed_at: retry ? null : new Date().toISOString() }).eq("id", run.id);
    await admin.from("crm_connections").update({ last_error: message.slice(0, 1000) }).eq("id", run.connection_id).eq("workspace_id", run.workspace_id);
    return { runId: run.id, status: retry ? "queued" : "failed", error: message };
  }
}
