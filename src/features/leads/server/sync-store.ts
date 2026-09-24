import { createAdminClient } from "@/lib/supabase/admin";
import { MAPS_APIFY_ID, MAPS_SLUG } from "@/features/leads/maps-source";
import type { Json } from "@/lib/database.types";
import type { ActorPricing } from "@/features/leads/source-pricing";

const PAGE_SIZE = 100;
const SAVE_CHUNK = 200;

type StoreItem = {
  id?: string;
  title?: string;
  name?: string;
  username?: string;
  description?: string | null;
  pictureUrl?: string | null;
  url?: string | null;
  categories?: string[];
  notice?: string | null;
  stats?: {
    totalUsers?: number;
    actorReviewRating?: number;
    actorReviewCount?: number;
  };
  currentPricingInfo?: ActorPricing | null;
};

type SourceRow = {
  apify_id: string;
  slug: string;
  title: string;
  description: string;
  picture_url: string | null;
  store_url: string | null;
  categories: string[];
  pricing_model: string | null;
  pricing_info: Json | null;
  notice: string | null;
  review_rating: number | null;
  review_count: number;
  total_users: number;
  synced_at: string;
  archived_at: null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRow(item: StoreItem, syncedAt: string): SourceRow | null {
  const id = item.id?.trim();
  const username = item.username?.trim();
  const name = item.name?.trim();
  const title = item.title?.trim();
  if (!id || !username || !name || !title) return null;
  const rating = item.stats?.actorReviewRating;
  return {
    apify_id: id,
    slug: `${username}/${name}`,
    title,
    description: (item.description || "").trim(),
    picture_url: item.pictureUrl || null,
    store_url: item.url || `https://apify.com/${username}/${name}`,
    categories: Array.isArray(item.categories) ? item.categories.filter((value) => typeof value === "string") : [],
    pricing_model: item.currentPricingInfo?.pricingModel || null,
    pricing_info: item.currentPricingInfo ? item.currentPricingInfo as unknown as Json : null,
    notice: item.notice || null,
    review_rating: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
    review_count: item.stats?.actorReviewCount || 0,
    total_users: item.stats?.totalUsers || 0,
    synced_at: syncedAt,
    archived_at: null,
  };
}

const SORTS = ["popularity", "newest", "lastUpdate", "relevance"] as const;

async function fetchStorePage(offset: number, sortBy: string) {
  const params = new URLSearchParams({
    category: "LEAD_GENERATION",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    sortBy,
  });
  let response = await fetch(`https://api.apify.com/v2/store?${params}`, { cache: "no-store" });
  if (response.status === 429) {
    await sleep(2000);
    response = await fetch(`https://api.apify.com/v2/store?${params}`, { cache: "no-store" });
  }
  if (!response.ok) {
    throw new Error(`Apify store ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    data?: { total?: number; count?: number; items?: StoreItem[] };
  };
  return {
    total: payload.data?.total || 0,
    count: payload.data?.count || 0,
    items: payload.data?.items || [],
  };
}

async function saveRows(rows: SourceRow[]) {
  const admin = createAdminClient();
  for (let index = 0; index < rows.length; index += SAVE_CHUNK) {
    const chunk = rows.slice(index, index + SAVE_CHUNK);
    const slugs = chunk.map((row) => row.slug);
    const apifyIds = chunk.map((row) => row.apify_id);
    const [{ data: bySlug, error: slugError }, { data: byApifyId, error: apifyIdError }] = await Promise.all([
      admin.from("scrape_sources").select("id, slug, apify_id").in("slug", slugs),
      admin.from("scrape_sources").select("id, slug, apify_id").in("apify_id", apifyIds),
    ]);
    if (slugError || apifyIdError) throw new Error(slugError?.message || apifyIdError?.message || "Không đối chiếu được catalog.");
    const existing = [...(bySlug || []), ...(byApifyId || [])];
    const idBySlug = new Map(existing.map((row) => [row.slug, row.id]));
    const idByApifyId = new Map(existing.map((row) => [row.apify_id, row.id]));
    const existingId = (row: SourceRow) => idBySlug.get(row.slug) || idByApifyId.get(row.apify_id);
    const inserts = chunk.filter((row) => !existingId(row));
    const updates = chunk
      .filter((row) => Boolean(existingId(row)))
      .map((row) => ({ ...row, id: existingId(row) as string }));
    if (inserts.length) {
      const { error } = await admin.from("scrape_sources").insert(inserts);
      if (error) throw new Error(error.message);
    }
    if (updates.length) {
      const { error } = await admin.from("scrape_sources").upsert(updates, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
  }
}

async function ensureMapsReady(syncedAt: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("scrape_sources").select("id").eq("slug", MAPS_SLUG).maybeSingle();
  const row = {
    apify_id: MAPS_APIFY_ID,
    slug: MAPS_SLUG,
    title: "Google Maps Scraper",
    description: "Extract data from Google Maps locations and businesses, including contact info.",
    store_url: "https://apify.com/compass/crawler-google-places",
    categories: ["LEAD_GENERATION", "TRAVEL"],
    pricing_model: "PAY_PER_EVENT",
    adapter_status: "ready",
    archived_at: null,
    synced_at: syncedAt,
  };
  if (existing) {
    const { error } = await admin
      .from("scrape_sources")
      .update({ adapter_status: "ready", archived_at: null, synced_at: syncedAt })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await admin.from("scrape_sources").insert(row);
  if (error) throw new Error(error.message);
}

export async function syncLeadGenerationStore() {
  const startedAt = new Date().toISOString();
  const first = await fetchStorePage(0, "popularity");
  if (first.total <= 0) {
    throw new Error("Apify trả về 0 actor. Catalog không bị ghi đè.");
  }

  for (const sortBy of SORTS) {
    let offset = 0;
    while (offset < 16000) {
      const page = offset === 0 && sortBy === "popularity" ? first : await fetchStorePage(offset, sortBy);
      if (!page.items.length) break;
      const rows = page.items.map((item) => toRow(item, startedAt)).filter((row): row is SourceRow => Boolean(row));
      await saveRows(rows);
      offset += page.items.length;
      await sleep(60);
    }
  }

  const admin = createAdminClient();
  const { error: archiveError } = await admin
    .from("scrape_sources")
    .update({ archived_at: startedAt })
    .lt("synced_at", startedAt)
    .is("archived_at", null);
  if (archiveError) throw new Error(archiveError.message);

  await ensureMapsReady(startedAt);
  const { count } = await admin.from("scrape_sources").select("id", { count: "exact", head: true }).is("archived_at", null);
  return { total: count || 0 };
}
