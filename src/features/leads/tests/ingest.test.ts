import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database, Json } from "@/lib/database.types";
import { ingestDatasetItems, mapPlaceItem } from "../server/apify";

type Stored = { raw: Json; workspace_id: string; job_id: string };
function fakeDatabase(initial: Stored[] = [], failBatch = 0) {
  const stored = [...initial];
  let inserts = 0;
  let counts: Record<string, unknown> = {};
  const db = { from(table: string) {
    const chain = {
      select() { return chain; }, eq() { return chain; }, order() { return chain; },
      async maybeSingle() { return { data: { slug: "test/actor", adapter_status: "preview", schema_fetched_at: "2026-09-24" }, error: null }; },
      async single() { return { data: { id: "collection" }, error: null }; },
      async range(from: number, to: number) { return { data: stored.slice(from, Math.min(to + 1, from + 100)), error: null }; },
      upsert() { return chain; },
      async insert(rows: Stored[]) {
        inserts++;
        assert.equal(table, "lead_scrape_results");
        assert.ok(rows.length <= 200);
        if (inserts === failBatch) return { error: { message: "temporary write failure" } };
        stored.push(...rows);
        return { error: null };
      },
      update(value: Record<string, unknown>) { counts = value; return chain; },
      then(resolve: (value: { error: null }) => unknown) { return Promise.resolve(resolve({ error: null })); },
    };
    return chain;
  } };
  return { db: db as unknown as Parameters<typeof ingestDatasetItems>[0], stored, counts: () => counts };
}

const job = { id: "job", workspace_id: "workspace", source_id: "source", apify_actor_id: "test/actor" } as Database["public"]["Tables"]["lead_scrape_jobs"]["Row"];
const items = Array.from({ length: 1205 }, (_, index) => ({ title: `Result ${index}`, profile: { followers: index }, results: [{ url: `https://example.com/${index}` }] }));

test("raw ingest stores more than 200/1000 rows, then re-syncs without duplicates", async () => {
  const fake = fakeDatabase();
  const first = await ingestDatasetItems(fake.db, job, items);
  assert.equal(first.placesFound, 1205);
  assert.equal(first.billPlaces, false);
  assert.equal(fake.stored.length, 1205);
  assert.equal(fake.counts().places_found, 1205);
  assert.deepEqual((fake.stored[1204].raw as Record<string, Json>).profile, { followers: 1204 });
  const second = await ingestDatasetItems(fake.db, job, items);
  assert.equal(second.placesFound, 1205);
  assert.equal(fake.stored.length, 1205);
  assert.ok(fake.stored.every((row) => row.workspace_id === "workspace" && row.job_id === "job"));
});

test("failed batch can resume, including legacy 200-row datasets", async () => {
  const fake = fakeDatabase([], 2);
  await assert.rejects(ingestDatasetItems(fake.db, job, items), /temporary write failure/);
  assert.equal(fake.stored.length, 200);
  const resumed = fakeDatabase(fake.stored);
  await ingestDatasetItems(resumed.db, job, items);
  assert.equal(resumed.stored.length, 1205);
  assert.equal(new Set(resumed.stored.map((row) => (row.raw as Record<string, Json>).ingest_key)).size, 1205);
});

test("Maps mapping still retains enriched contacts and original output", () => {
  const place = mapPlaceItem({ title: "Coffee", placeId: "p1", website: "https://example.com", leadsEnrichment: [{ fullName: "An", email: "AN@example.com", jobTitle: "Manager" }] });
  assert.equal(place.name, "Coffee");
  assert.equal(place.google_place_id, "p1");
  assert.equal(place.people[0].email, "an@example.com");
  assert.equal(place.people[0].job_title, "Manager");
});
