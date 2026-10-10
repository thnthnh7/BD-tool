import assert from "node:assert/strict";
import test from "node:test";
import type { Json } from "@/lib/database.types";
import { inferRecordType, normalizeDataRecord } from "../normalize";

test("classifies common heterogeneous actor outputs", () => {
  assert.equal(inferRecordType({ placeId: "abc", address: "Ho Chi Minh City" }), "place");
  assert.equal(inferRecordType({ username: "leadely", followersCount: 1200 }), "person_profile");
  assert.equal(inferRecordType({ jobTitle: "Sales Manager", employmentType: "FULL_TIME" }), "job_listing");
  assert.equal(inferRecordType({ caption: "Launch day", likesCount: 42 }), "social_content");
  assert.equal(inferRecordType({ url: "https://example.com/catalog.pdf" }), "document");
  assert.equal(inferRecordType({ arbitrary: true }), "generic_record");
});

test("keeps the original payload while producing stable searchable metadata", () => {
  const actorItem = {
    fullName: "Ada Lovelace",
    profileUrl: "https://www.linkedin.com/in/ada",
    email: "ada@example.com",
    nested: { source: "actor" },
  };
  const first = normalizeDataRecord(actorItem, 0);
  const second = normalizeDataRecord(actorItem, 0);

  assert.equal(first.title, "Ada Lovelace");
  assert.equal(first.canonicalUrl, "https://linkedin.com/in/ada");
  assert.deepEqual(first.rawData, actorItem);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first.identityKeys, {
    url: "https://linkedin.com/in/ada",
    email: actorItem.email,
  });
  assert.equal(first.qualityScore, 80);
  assert.ok(first.identityFingerprint);
  assert.deepEqual(first.qualityIssues, ["missing_description"]);
});

test("canonicalizes identity values so duplicate inputs share a fingerprint", () => {
  const first = normalizeDataRecord({ name: "Ada", email: " ADA@Example.COM ", url: "https://www.example.com/profile/?utm_source=test" }, 0);
  const second = normalizeDataRecord({ name: "Ada L.", email: "ada@example.com", url: "https://example.com/profile" }, 1);
  assert.equal((first.normalizedData as Record<string, Json>).email, "ada@example.com");
  assert.equal((first.normalizedData as Record<string, Json>).url, "https://example.com/profile");
  assert.equal(first.identityFingerprint, second.identityFingerprint);
});

test("supports a known adapter override without losing the raw actor item", () => {
  const normalized = normalizeDataRecord({ name: "A shop", latitude: 10.7 }, 3, "organization");
  assert.equal(normalized.recordType, "organization");
  assert.deepEqual(normalized.rawData, { name: "A shop", latitude: 10.7 });
});
