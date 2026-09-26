import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(first.canonicalUrl, actorItem.profileUrl);
  assert.deepEqual(first.rawData, actorItem);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first.identityKeys, {
    url: actorItem.profileUrl,
    email: actorItem.email,
  });
});

test("supports a known adapter override without losing the raw actor item", () => {
  const normalized = normalizeDataRecord({ name: "A shop", latitude: 10.7 }, 3, "organization");
  assert.equal(normalized.recordType, "organization");
  assert.deepEqual(normalized.rawData, { name: "A shop", latitude: 10.7 });
});
