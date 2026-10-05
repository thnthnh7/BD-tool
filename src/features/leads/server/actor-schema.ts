import type { Json } from "@/lib/database.types";
import { isMapsActor } from "@/features/leads/maps-source";
import { createAdminClient } from "@/lib/supabase/admin";

type Contract = {
  inputSchema: Json;
  exampleInput: Json | null;
  outputSchema: Json | null;
  schemaFetchedAt: string;
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
    return {
      inputSchema: inputSchema as Json,
      exampleInput: exampleInput ? (exampleInput as Json) : null,
      outputSchema: outputSummary(build.actorDefinition),
      schemaFetchedAt: fetchedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được actor từ Apify.";
    return { error: message };
  }
}

export async function ensureSourceContract(sourceId: string, token?: string): Promise<{
  error: string | null;
  inputSchema: Json | null;
  exampleInput: Json | null;
  stale?: boolean;
}> {
  const empty = { inputSchema: null, exampleInput: null };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scrape_sources")
    .select("id, slug, input_schema, example_input, schema_fetched_at")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) return { error: error.message, ...empty };
  if (!data) return { error: "Không thấy nguồn.", ...empty };
  if (isMapsActor(data.slug)) return { error: null, ...empty };
  const fetchedAt = data.schema_fetched_at ? Date.parse(data.schema_fetched_at) : Number.NaN;
  const isFresh = data.input_schema && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CONTRACT_MAX_AGE_MS;
  if (isFresh) {
    return { error: null, inputSchema: data.input_schema, exampleInput: data.example_input };
  }
  const contract = await fetchActorContract(data.slug, token);
  if ("error" in contract) {
    if (data.input_schema) {
      return { error: null, inputSchema: data.input_schema, exampleInput: data.example_input, stale: true };
    }
    return { error: contract.error, ...empty };
  }
  const { error: updateError } = await admin
    .from("scrape_sources")
    .update({
      input_schema: contract.inputSchema,
      example_input: contract.exampleInput,
      output_schema: contract.outputSchema,
      schema_fetched_at: contract.schemaFetchedAt,
    })
    .eq("id", data.id);
  if (updateError) return { error: updateError.message, ...empty };
  return { error: null, inputSchema: contract.inputSchema, exampleInput: contract.exampleInput };
}
