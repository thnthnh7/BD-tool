import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { apifyActorPath, isMapsActor, MAPS_SLUG } from "@/features/leads/maps-source";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementUsage } from "@/lib/usage";
import { readAllPages } from "@/features/leads/server/read-pages";
import { getApifyConnectionToken, syncApifyConnection } from "@/features/leads/server/apify-connection";
import { normalizeDataRecord, type DataRecordType } from "@/features/data-library/normalize";

type Db = SupabaseClient<Database>;
type Job = Database["public"]["Tables"]["lead_scrape_jobs"]["Row"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function domainFromWebsite(website: string) {
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() || "";
  }
}

function parsePeople(raw: Record<string, unknown>) {
  const buckets = [raw.leadsEnrichment, raw.people, raw.contacts, raw.enrichedPeople];
  const rows: Record<string, unknown>[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const row = asRecord(item);
      if (row.firstName || row.lastName || row.fullName || row.name || row.email || row.linkedinUrl) {
        rows.push(row);
      }
    }
  }
  return rows;
}

export function mapPlaceItem(item: unknown) {
  const raw = asRecord(item);
  const location = asRecord(raw.location);
  const name = text(raw.title || raw.name);
  const website = text(raw.website || raw.websiteUncertain);
  const people = parsePeople(raw).map((person) => {
    const fullName = text(person.fullName || person.name || `${text(person.firstName)} ${text(person.lastName)}`);
    return {
      first_name: text(person.firstName || person.first_name),
      last_name: text(person.lastName || person.last_name),
      full_name: fullName,
      email: text(person.email).toLowerCase(),
      phone: text(person.phone || person.mobile),
      job_title: text(person.jobTitle || person.title || person.position),
      linkedin_url: text(person.linkedinUrl || person.linkedin),
      department: text(person.department),
      seniority: text(person.seniority),
      email_verification: text(person.emailUnreachable === true ? "invalid" : person.emailStatus || person.email_verification),
      raw: person as Json,
    };
  });
  return {
    google_place_id: text(raw.placeId || raw.place_id || raw.fid) || null,
    name,
    category: text(raw.categoryName || raw.category) || null,
    address: text(raw.address || raw.street) || null,
    city: text(raw.city) || null,
    phone: text(raw.phone) || null,
    website: website || null,
    email: text(raw.email || (Array.isArray(raw.emails) ? raw.emails[0] : "")) || null,
    rating: number(raw.totalScore || raw.rating),
    reviews_count: number(raw.reviewsCount || raw.reviews_count),
    lat: number(location.lat || raw.lat),
    lng: number(location.lng || raw.lng),
    maps_url: text(raw.url || raw.mapsUrl) || null,
    image_url: text(Array.isArray(raw.imageUrls) ? raw.imageUrls[0] : raw.imageUrl) || null,
    raw: raw as Json,
    people,
  };
}

function ingestKeyFromRaw(raw: Json) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as { ingest_key?: unknown }).ingest_key;
  return typeof value === "number" ? value : null;
}

async function syncDataLibrary(supabase: Db, job: Job, items: unknown[], forcedType?: DataRecordType) {
  const { data: collection, error: collectionError } = await supabase
    .from("data_collections")
    .upsert({
      workspace_id: job.workspace_id,
      scrape_job_id: job.id,
      name: job.query || job.apify_actor_id,
      description: job.location || "",
      source_type: "apify_dataset",
      source_actor_id: job.apify_actor_id,
      external_dataset_id: job.apify_dataset_id,
      record_count: items.length,
      status: "active",
      created_by: job.created_by,
    }, { onConflict: "scrape_job_id" })
    .select("id")
    .single();
  if (collectionError || !collection) throw new Error(collectionError?.message || "Không tạo được Data Library collection.");

  for (let start = 0; start < items.length; start += 200) {
    const rows = items.slice(start, start + 200).map((item, offset) => {
      const index = start + offset;
      const normalized = normalizeDataRecord(item, index, forcedType);
      return {
        workspace_id: job.workspace_id,
        collection_id: collection.id,
        source_item_key: String(index),
        record_type: normalized.recordType,
        title: normalized.title,
        canonical_url: normalized.canonicalUrl,
        normalized_data: normalized.normalizedData,
        raw_data: normalized.rawData,
        identity_keys: normalized.identityKeys,
        content_hash: normalized.contentHash,
        captured_at: job.finished_at || new Date().toISOString(),
      };
    });
    const { error } = await supabase.from("data_records").upsert(rows, { onConflict: "collection_id,source_item_key" });
    if (error) throw new Error(error.message);
  }
}

export async function claimScrapeIngest(
  supabase: Db,
  input: {
    jobId: string;
    workspaceId?: string;
    datasetId: string;
    runId?: string | null;
    fromStatuses?: Array<"queued" | "running" | "failed" | "succeeded">;
  },
) {
  let query = supabase
    .from("lead_scrape_jobs")
    .update({
      status: "ingesting",
      apify_dataset_id: input.datasetId,
      apify_run_id: input.runId || null,
      error_message: null,
    })
    .eq("id", input.jobId)
    .in("status", input.fromStatuses ?? ["queued", "running"]);
  if (input.workspaceId) query = query.eq("workspace_id", input.workspaceId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error?.code === "23505") {
    return { error: "Workspace đang có một lượt scrape chưa xong.", job: null, busy: true as const };
  }
  if (error) return { error: error.message, job: null, busy: false as const };
  return { job: data, error: null, busy: false as const };
}

async function assertSupportedAdapter(supabase: Db, job: Job) {
  if (job.source_id) {
    const { data, error } = await supabase
      .from("scrape_sources")
      .select("slug, adapter_status")
      .eq("id", job.source_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.adapter_status !== "ready" || !isMapsActor(data.slug)) {
      throw new Error("Actor này chưa có adapter.");
    }
    return;
  }
  if (!isMapsActor(job.apify_actor_id)) {
    throw new Error("Actor này chưa có adapter.");
  }
}

async function ingestMode(supabase: Db, job: Job) {
  if (!job.source_id) return isMapsActor(job.apify_actor_id) ? "maps" : "unsupported";
  const { data, error } = await supabase
    .from("scrape_sources")
    .select("slug, adapter_status, schema_fetched_at")
    .eq("id", job.source_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "unsupported";
  if (isMapsActor(data.slug) && data.adapter_status === "ready") return "maps";
  if (data.schema_fetched_at) return "raw";
  return "unsupported";
}

function rawItemLabel(raw: Record<string, unknown>, index: number) {
  for (const key of ["title", "name", "query", "url"]) {
    const value = text(raw[key]);
    if (value) return value.slice(0, 180);
  }
  const first = Object.values(raw).find((value) => typeof value === "string" && value.trim());
  return typeof first === "string" ? first.trim().slice(0, 180) : `Kết quả ${index + 1}`;
}

async function ingestRawItems(supabase: Db, job: Job, items: unknown[]) {
  const existing = await readAllPages((from, to) => supabase.from("lead_scrape_results").select("raw").eq("job_id", job.id).eq("workspace_id", job.workspace_id).order("id").range(from, to));
  const seen = new Set(existing.map((row) => ingestKeyFromRaw(row.raw)).filter((key): key is number => key != null));
  const rows = items.flatMap((item, index) => {
    if (seen.has(index)) return [];
    const raw = asRecord(item);
    return [{
      workspace_id: job.workspace_id,
      job_id: job.id,
      name: rawItemLabel(raw, index),
      raw: { ...raw, ingest_key: index } as Json,
      match_status: "new" as const,
      selected: false,
    }];
  });
  for (let index = 0; index < rows.length; index += 200) {
    const { error } = await supabase.from("lead_scrape_results").insert(rows.slice(index, index + 200));
    if (error) throw new Error(error.message);
  }
  const placesFound = existing.length + rows.length;
  const { error: countError } = await supabase.from("lead_scrape_jobs").update({ places_found: placesFound, people_found: 0 }).eq("id", job.id);
  if (countError) throw new Error(countError.message);
  await syncDataLibrary(supabase, job, items);
  return { placesFound, peopleFound: 0, billPlaces: false as const };
}

export async function ingestDatasetItems(supabase: Db, job: Job, items: unknown[]) {
  const mode = await ingestMode(supabase, job);
  if (mode === "raw") return ingestRawItems(supabase, job, items);
  if (mode !== "maps") throw new Error("Actor này chưa có adapter.");
  await assertSupportedAdapter(supabase, job);
  const mappedItems = items
    .map((item, index) => ({ index, mapped: mapPlaceItem(item) }))
    .filter((item) => item.mapped.name);
  const placeIds = [...new Set(mappedItems.map((item) => item.mapped.google_place_id).filter((id): id is string => Boolean(id)))];
  const domains = [
    ...new Set(
      mappedItems
        .map((item) => (item.mapped.website ? domainFromWebsite(item.mapped.website) : ""))
        .filter(Boolean),
    ),
  ];
  const emails = [
    ...new Set(
      mappedItems.flatMap((item) => item.mapped.people.map((person) => person.email).filter(Boolean)),
    ),
  ];

  const companyLookup =
    placeIds.length || domains.length
      ? await supabase.rpc("lookup_companies_for_ingest", {
          p_workspace_id: job.workspace_id,
          p_place_ids: placeIds,
          p_domains: domains,
        })
      : { data: [], error: null };
  if (companyLookup.error) throw new Error(companyLookup.error.message);
  const companies = companyLookup.data || [];
  const contactLookup = emails.length
    ? await supabase.rpc("lookup_contacts_for_ingest", { p_workspace_id: job.workspace_id, p_emails: emails })
    : { data: [], error: null };
  if (contactLookup.error) throw new Error(contactLookup.error.message);
  const contacts = contactLookup.data || [];

  const resultRows = mappedItems.map(({ index, mapped }) => {
    const domain = mapped.website ? domainFromWebsite(mapped.website) : "";
    const matched =
      companies.find((company) => mapped.google_place_id && company.external_place_id === mapped.google_place_id) ||
      companies.find((company) => domain && company.domain.toLowerCase() === domain);
    const raw = mapped.raw && typeof mapped.raw === "object" && !Array.isArray(mapped.raw) ? mapped.raw : {};
    return {
      workspace_id: job.workspace_id,
      job_id: job.id,
      google_place_id: mapped.google_place_id,
      name: mapped.name,
      category: mapped.category,
      address: mapped.address,
      city: mapped.city,
      phone: mapped.phone,
      website: mapped.website,
      email: mapped.email,
      rating: mapped.rating,
      reviews_count: mapped.reviews_count,
      lat: mapped.lat,
      lng: mapped.lng,
      maps_url: mapped.maps_url,
      image_url: mapped.image_url,
      raw: { ...raw, ingest_key: index } as Json,
      match_status: matched ? ("duplicate_company" as const) : ("new" as const),
      matched_company_id: matched?.id || null,
      selected: !matched,
    };
  });

  const inserted = resultRows.length
    ? await supabase.from("lead_scrape_results").insert(resultRows).select("id, raw")
    : { data: [], error: null };
  if (inserted.error) throw new Error(inserted.error.message);

  const resultIdByKey = new Map<number, string>();
  for (const row of inserted.data || []) {
    const key = ingestKeyFromRaw(row.raw);
    if (key != null) resultIdByKey.set(key, row.id);
  }

  const peopleRows = mappedItems.flatMap(({ index, mapped }) => {
    const resultId = resultIdByKey.get(index);
    if (!resultId) return [];
    return mapped.people.slice(0, job.max_people_per_place).map((person) => {
      const matchedContact = contacts.find((row) => person.email && row.email.toLowerCase() === person.email);
      return {
        workspace_id: job.workspace_id,
        result_id: resultId,
        first_name: person.first_name || null,
        last_name: person.last_name || null,
        full_name: person.full_name || null,
        email: person.email || null,
        phone: person.phone || null,
        job_title: person.job_title || null,
        linkedin_url: person.linkedin_url || null,
        department: person.department || null,
        seniority: person.seniority || null,
        email_verification: person.email_verification || null,
        raw: person.raw,
        match_status: matchedContact ? ("duplicate_contact" as const) : ("new" as const),
        matched_contact_id: matchedContact?.id || null,
        selected: !matchedContact,
      };
    });
  });

  if (peopleRows.length) {
    const { error } = await supabase.from("lead_scrape_people").insert(peopleRows);
    if (error) throw new Error(error.message);
  }

  const placesFound = resultIdByKey.size;
  const peopleFound = peopleRows.length;
  await supabase
    .from("lead_scrape_jobs")
    .update({ places_found: placesFound, people_found: peopleFound })
    .eq("id", job.id);

  await syncDataLibrary(supabase, job, items, "place");

  return { placesFound, peopleFound, billPlaces: true as const };
}

export async function runScrapeIngest(job: Job) {
  const supabase = createAdminClient();
  try {
    if (!job.apify_dataset_id) throw new Error("Job chưa có dataset.");
    if (!job.apify_connection_id) throw new Error("Job không có kết nối Apify.");
    const token = await getApifyConnectionToken(job.apify_connection_id);
    const run = job.apify_run_id ? await fetchApifyRun(job.apify_run_id, token).catch(() => null) : null;
    if (run?.usageTotalUsd != null) {
      await supabase.from("lead_scrape_jobs").update({ apify_usage_usd: run.usageTotalUsd }).eq("id", job.id);
    }
    const items = await fetchApifyDatasetItems(job.apify_dataset_id, token);
    const ingested = await ingestDatasetItems(supabase, job, items);
    if (ingested.billPlaces) {
      const placesQuota = await incrementUsage(
        supabase,
        job.workspace_id,
        "maps_places",
        ingested.placesFound,
        -1,
      );
      if (placesQuota.error) {
        await supabase
          .from("lead_scrape_jobs")
          .update({ status: "failed", error_message: placesQuota.error, finished_at: new Date().toISOString() })
          .eq("id", job.id);
        return;
      }
      if (ingested.peopleFound) {
        const peopleQuota = await incrementUsage(
          supabase,
          job.workspace_id,
          "maps_people",
          ingested.peopleFound,
          -1,
        );
        if (peopleQuota.error) {
          await supabase
            .from("lead_scrape_jobs")
            .update({ status: "failed", error_message: peopleQuota.error, finished_at: new Date().toISOString() })
            .eq("id", job.id);
          return;
        }
      }
    }
    await supabase
      .from("lead_scrape_jobs")
      .update({ status: "succeeded", error_message: null, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    await syncApifyConnection(job.apify_connection_id, token).catch(() => null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    await supabase
      .from("lead_scrape_jobs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", job.id);
  }
}

export async function fetchApifyDatasetItems(datasetId: string, token: string) {
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
    { cache: "no-store", headers: { Authorization: `Bearer ${token}`, "x-apify-integration-platform": "leadely" } },
  );
  if (!response.ok) {
    throw new Error(`Apify dataset ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as unknown[];
}

// https://docs.apify.com/api/v2/actor-run-get
export async function fetchApifyRun(runId: string, token: string) {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Không đọc được lần chạy Apify (${response.status}).`);
  const payload = await response.json() as { data?: { status?: string; usageTotalUsd?: number } };
  if (!payload.data?.status) throw new Error("Apify không trả về trạng thái lần chạy.");
  const usageTotalUsd = payload.data.usageTotalUsd;
  return { status: payload.data.status, usageTotalUsd: typeof usageTotalUsd === "number" && Number.isFinite(usageTotalUsd) ? usageTotalUsd : null };
}

// https://docs.apify.com/api/v2/actor-run-abort-post
export async function abortApifyRun(runId: string, token: string) {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/abort?gracefully=false`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-apify-integration-platform": "leadely" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Apify abort ${response.status}: ${raw.slice(0, 200)}`);
  const payload = raw ? JSON.parse(raw) as { data?: { status?: string; usageTotalUsd?: number } } : {};
  const usageTotalUsd = payload.data?.usageTotalUsd;
  return {
    status: payload.data?.status || "ABORTING",
    usageTotalUsd: typeof usageTotalUsd === "number" && Number.isFinite(usageTotalUsd) ? usageTotalUsd : null,
  };
}

export async function startApifyActorRun(input: { actorSlug: string; body: Record<string, unknown>; webhookUrl: string; token: string }) {
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
        requestUrl: input.webhookUrl,
      },
    ]),
    "utf8",
  ).toString("base64");

  const response = await fetch(
    `https://api.apify.com/v2/acts/${apifyActorPath(input.actorSlug)}/runs?webhooks=${encodeURIComponent(webhooks)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.token}`, "x-apify-integration-platform": "leadely" },
      body: JSON.stringify(input.body),
      cache: "no-store",
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(`Apify start ${response.status}: ${raw.slice(0, 240)}`);
  const payload = JSON.parse(raw) as { data?: { id?: string; defaultDatasetId?: string } };
  return {
    runId: payload.data?.id || "",
    datasetId: payload.data?.defaultDatasetId || "",
  };
}

export async function startApifyMapsRun(input: {
  jobId: string;
  query: string;
  location: string;
  language: string;
  maxResults: number;
  enrichPeople: boolean;
  maxPeoplePerPlace: number;
  verifyEmails: boolean;
  webhookUrl: string;
  token: string;
}) {
  const body = {
    searchStringsArray: [input.query],
    locationQuery: input.location,
    language: input.language,
    maxCrawledPlacesPerSearch: input.maxResults,
    skipClosedPlaces: true,
    scrapeContacts: true,
    maximumLeadsEnrichmentRecords: input.enrichPeople ? input.maxPeoplePerPlace : 0,
    scrapeContactsFromWebsite: true,
    maxReviews: 0,
    maxImages: 0,
    ...(input.verifyEmails ? { verifyLeadsEnrichmentEmails: true } : {}),
  };
  return startApifyActorRun({ actorSlug: MAPS_SLUG, body, webhookUrl: input.webhookUrl, token: input.token });
}
