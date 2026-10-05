import type { Json } from "@/lib/database.types";
import { isMapsActor } from "@/features/leads/maps-source";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

type Contract = {
  inputSchema: Json;
  exampleInput: Json | null;
  outputSchema: Json | null;
  schemaFetchedAt: string;
  buildId: string;
  buildNumber: string | null;
  buildTag: string;
  contractHash: string;
  readmeMarkdown: string;
  rootDescription: string;
  pricingSnapshot: Json | null;
  actorStoreUrl: string;
};

const CONTRACT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function readJson(url: string, token?: string) {
  const response = await fetch(url, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const payload = (await response.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Apify ${response.status}`);
  }
  return payload.data || {};
}

function parseJsonValue(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  return Object.keys(record).length ? record : null;
}

function outputSummary(definition: unknown): Json | null {
  const storages = asRecord(asRecord(definition).storages);
  const dataset = asRecord(storages.dataset);
  const fields = asRecord(dataset.fields);
  const names = Object.keys(fields).slice(0, 80);
  if (!names.length) return null;
  return { fields: names };
}

function jsonValue(value: unknown): Json | null {
  if (value == null) return null;
  try { return JSON.parse(JSON.stringify(value)) as Json; }
  catch { return null; }
}

function contractHash(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function fetchActorContract(slug: string, token?: string): Promise<Contract | { error: string }> {
  const actorPath = slug.replaceAll("/", "~");
  try {
    const actor = await readJson(`https://api.apify.com/v2/actors/${actorPath}`, token);
    const build = await readJson(`https://api.apify.com/v2/actors/${actorPath}/builds/default`, token);
    const inputSchema = parseJsonValue(build.inputSchema);
    const properties = asRecord(inputSchema?.properties);
    if (!inputSchema || !Object.keys(properties).length) {
      return { error: "Apify không có input schema cho actor này." };
    }
    const exampleBody = asRecord(actor.exampleRunInput).body;
    const exampleInput = parseJsonValue(exampleBody);
    const fetchedAt = new Date().toISOString();
    const readmeMarkdown = typeof build.readme === "string" ? build.readme.slice(0, 250_000) : "";
    const buildId = typeof build.id === "string" ? build.id : "default";
    const buildNumber = typeof build.buildNumber === "string" ? build.buildNumber : null;
    const buildTag = "default";
    const rootDescription = typeof inputSchema.description === "string" ? inputSchema.description.slice(0, 20_000) : "";
    const pricingSnapshot = jsonValue(actor.pricingInfos);
    const actorStoreUrl = `https://apify.com/${slug}`;
    const outputSchema = outputSummary(build.actorDefinition);
    return {
      inputSchema: inputSchema as Json,
      exampleInput: exampleInput ? (exampleInput as Json) : null,
      outputSchema,
      schemaFetchedAt: fetchedAt,
      buildId,
      buildNumber,
      buildTag,
      contractHash: contractHash([buildId, buildNumber, inputSchema, outputSchema, readmeMarkdown]),
      readmeMarkdown,
      rootDescription,
      pricingSnapshot,
      actorStoreUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được actor từ Apify.";
    return { error: message };
  }
}

export async function ensureSourceContract(sourceId: string, token?: string, force = false): Promise<{
  error: string | null;
  inputSchema: Json | null;
  exampleInput: Json | null;
  stale?: boolean;
  readmeMarkdown?: string;
  buildId?: string | null;
  buildNumber?: string | null;
  contractHash?: string | null;
  fetchedAt?: string | null;
  actorStoreUrl?: string | null;
  fetchStatus?: string;
}> {
  const empty = { inputSchema: null, exampleInput: null };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scrape_sources")
    .select("id, slug, input_schema, example_input, schema_fetched_at, actor_build_id, actor_build_number, contract_hash, readme_markdown, actor_store_url, contract_fetch_status")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) return { error: error.message, ...empty };
  if (!data) return { error: "Không thấy nguồn.", ...empty };
  if (isMapsActor(data.slug)) return { error: null, ...empty };
  const fetchedAt = data.schema_fetched_at ? Date.parse(data.schema_fetched_at) : Number.NaN;
  const isFresh = data.input_schema && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CONTRACT_MAX_AGE_MS;
  if (isFresh && !force) {
    return {
      error: null, inputSchema: data.input_schema, exampleInput: data.example_input,
      readmeMarkdown: data.readme_markdown || "", buildId: data.actor_build_id, buildNumber: data.actor_build_number,
      contractHash: data.contract_hash, fetchedAt: data.schema_fetched_at, actorStoreUrl: data.actor_store_url,
      fetchStatus: data.contract_fetch_status,
    };
  }
  const contract = await fetchActorContract(data.slug, token);
  if ("error" in contract) {
    await admin.from("scrape_sources").update({
      contract_last_checked_at: new Date().toISOString(),
      contract_fetch_status: data.input_schema ? "stale" : "error",
      contract_fetch_error: contract.error.slice(0, 2000),
    }).eq("id", data.id);
    if (data.input_schema) {
      return {
        error: null, inputSchema: data.input_schema, exampleInput: data.example_input, stale: true,
        readmeMarkdown: data.readme_markdown || "", buildId: data.actor_build_id, buildNumber: data.actor_build_number,
        contractHash: data.contract_hash, fetchedAt: data.schema_fetched_at, actorStoreUrl: data.actor_store_url,
        fetchStatus: "stale",
      };
    }
    return { error: contract.error, ...empty };
  }
  const { error: versionError } = await admin.from("scrape_source_contract_versions").upsert({
    source_id: data.id,
    actor_slug: data.slug,
    build_id: contract.buildId,
    build_number: contract.buildNumber,
    build_tag: contract.buildTag,
    contract_hash: contract.contractHash,
    input_schema: contract.inputSchema,
    example_input: contract.exampleInput,
    readme_markdown: contract.readmeMarkdown || null,
    root_description: contract.rootDescription || null,
    output_schema: contract.outputSchema,
    pricing_snapshot: contract.pricingSnapshot,
    actor_store_url: contract.actorStoreUrl,
    fetched_at: contract.schemaFetchedAt,
  }, { onConflict: "source_id,contract_hash", ignoreDuplicates: true });
  if (versionError) return { error: versionError.message, ...empty };
  const { error: updateError } = await admin
    .from("scrape_sources")
    .update({
      input_schema: contract.inputSchema,
      example_input: contract.exampleInput,
      output_schema: contract.outputSchema,
      schema_fetched_at: contract.schemaFetchedAt,
      actor_build_id: contract.buildId,
      actor_build_number: contract.buildNumber,
      actor_build_tag: contract.buildTag,
      contract_hash: contract.contractHash,
      readme_markdown: contract.readmeMarkdown || null,
      contract_last_checked_at: contract.schemaFetchedAt,
      contract_fetch_status: "ready",
      contract_fetch_error: null,
      actor_store_url: contract.actorStoreUrl,
    })
    .eq("id", data.id);
  if (updateError) return { error: updateError.message, ...empty };
  return {
    error: null, inputSchema: contract.inputSchema, exampleInput: contract.exampleInput,
    readmeMarkdown: contract.readmeMarkdown, buildId: contract.buildId, buildNumber: contract.buildNumber,
    contractHash: contract.contractHash, fetchedAt: contract.schemaFetchedAt, actorStoreUrl: contract.actorStoreUrl,
    fetchStatus: "ready",
  };
}
