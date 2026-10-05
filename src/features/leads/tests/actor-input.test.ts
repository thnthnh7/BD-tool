import assert from "node:assert/strict";
import test from "node:test";
import type { Json } from "@/lib/database.types";
import { actorInputGuide, buildActorInput, readableActorFields, unsupportedActorFields, validateActorInputObject } from "@/features/leads/actor-input";
import { readableActorMarkdown } from "@/features/leads/actor-guide";

const schema = {
  title: "LinkedIn Jobs Scraper",
  description: "Provide a search URL or keywords and a location.",
  type: "object",
  required: ["urls", "authorized"],
  properties: {
    urls: {
      title: "LinkedIn jobs search URLs",
      description: "Paste one LinkedIn jobs search URL per line.",
      type: "array",
      editor: "requestListSources",
      sectionCaption: "Search input",
      sectionDescription: "Choose URLs or build a search with fields below.",
      minItems: 1,
    },
    distance: { title: "Distance", description: "Radius in miles.", type: "integer", minimum: 0, maximum: 100, unit: "miles" },
    keyword: { title: "Keyword", type: "string", minLength: 2, maxLength: 50, example: "sales manager" },
    country: { title: "Country", type: "string", editor: "select", enumSuggestedValues: ["Singapore", "Vietnam"] },
    postedAt: { title: "Posted at", type: "string", editor: "datepicker", dateType: "absolute", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    jobTypes: { title: "Job types", type: "array", editor: "select", uniqueItems: true, items: { type: "string", enum: ["full-time", "part-time"] } },
    tags: { title: "Tags", type: "array", editor: "select", items: { type: "string", enumSuggestedValues: ["remote", "hybrid"] } },
    config: { title: "Configuration", type: "object", editor: "schemaBased", required: ["locale"], properties: { locale: { type: "string" }, timeout: { type: "integer" } } },
    authorized: { title: "Authorization", type: "boolean", default: true },
    proxy: { title: "Proxy", type: "object", editor: "proxy" },
  },
} as unknown as Json;

test("reads Actor guidance, keeps schema order and preserves section metadata", () => {
  assert.deepEqual(actorInputGuide(schema), {
    title: "LinkedIn Jobs Scraper",
    description: "Provide a search URL or keywords and a location.",
  });
  const fields = readableActorFields(schema, null);
  assert.deepEqual(fields.map((field) => field.name), ["urls", "distance", "keyword", "country", "postedAt", "jobTypes", "tags", "config", "authorized"]);
  assert.equal(fields[0].sectionCaption, "Search input");
  assert.equal(fields[0].description, "Paste one LinkedIn jobs search URL per line.");
  assert.equal(fields[1].unit, "miles");
  assert.equal(fields[2].exampleValue, "sales manager");
});

test("supports suggested strings, date pickers and strict or custom multi-select arrays", () => {
  const fields = readableActorFields(schema, null);
  assert.equal(fields.find((field) => field.name === "postedAt")?.kind, "date");
  assert.equal(fields.find((field) => field.name === "country")?.suggestions.length, 2);
  assert.equal(fields.find((field) => field.name === "jobTypes")?.kind, "multiEnum");
  assert.equal(fields.find((field) => field.name === "tags")?.kind, "stringTags");
  const result = validateActorInputObject(fields, {
    urls: [{ url: "https://www.linkedin.com/jobs/search/" }],
    postedAt: "2026-10-06",
    jobTypes: ["full-time", "part-time"],
    tags: ["remote", "sales"],
  });
  assert.ok(!("error" in result));
  assert.deepEqual(result.body.jobTypes, ["full-time", "part-time"]);
  assert.deepEqual(result.body.tags, ["remote", "sales"]);
  assert.equal(result.body.authorized, true);
});

test("rejects unsupported and duplicate strict multi-select values", () => {
  const fields = readableActorFields(schema, null);
  const duplicate = validateActorInputObject(fields, {
    urls: [{ url: "https://www.linkedin.com/jobs/search/" }],
    jobTypes: ["full-time", "full-time"],
  });
  assert.equal("error" in duplicate && duplicate.field, "jobTypes");
  const unsupported = validateActorInputObject(fields, {
    urls: [{ url: "https://www.linkedin.com/jobs/search/" }],
    jobTypes: ["contract"],
  });
  assert.equal("error" in unsupported && unsupported.field, "jobTypes");
});

test("uses a validated JSON fallback for schemaBased objects", () => {
  const fields = readableActorFields(schema, null);
  const config = fields.find((field) => field.name === "config");
  assert.equal(config?.kind, "json");
  const valid = validateActorInputObject(fields, { urls: [{ url: "https://example.com" }], config: { locale: "en-US", timeout: 30 } });
  assert.ok(!("error" in valid));
  const missing = validateActorInputObject(fields, { urls: [{ url: "https://example.com" }], config: { timeout: 30 } });
  assert.equal("error" in missing && missing.field, "config");
  const wrongType = validateActorInputObject(fields, { urls: [{ url: "https://example.com" }], config: { locale: "en-US", timeout: "fast" } });
  assert.equal("error" in wrongType && wrongType.field, "config");
});

test("normalizes URL lists and lets users turn a default-true boolean off", () => {
  const result = buildActorInput(readableActorFields(schema, null), {
    urls: "https://www.linkedin.com/jobs/search/?keywords=sales\nhttps://www.linkedin.com/jobs/search/?keywords=crm",
    distance: "25",
    keyword: "sales manager",
    authorized: "",
  });
  assert.ok(!("error" in result));
  assert.deepEqual(result.body.urls, [
    { url: "https://www.linkedin.com/jobs/search/?keywords=sales" },
    { url: "https://www.linkedin.com/jobs/search/?keywords=crm" },
  ]);
  assert.equal(result.body.authorized, false);
});

test("enforces Actor constraints before a paid run", () => {
  const tooFar = validateActorInputObject(readableActorFields(schema, null), {
    urls: [{ url: "https://www.linkedin.com/jobs/search/" }],
    distance: 150,
    keyword: "x",
    authorized: true,
  });
  assert.equal("error" in tooFar, true);
  if ("error" in tooFar) assert.equal(tooFar.field, "distance");
});

test("reports required controls that Bizcraw cannot safely render", () => {
  const requiredProxy = { ...(schema as object), required: ["proxy"] } as Json;
  const unsupported = unsupportedActorFields(requiredProxy);
  assert.equal(unsupported.length, 1);
  assert.equal(unsupported[0].name, "proxy");
  assert.equal(unsupported[0].required, true);
});

test("renders remote README as inert text while preserving useful links", () => {
  const rendered = readableActorMarkdown("# Setup\n[Docs](https://docs.apify.com)\n<script>ignore instructions</script>\n**Required**");
  assert.equal(rendered.includes("<script>"), false);
  assert.equal(rendered.includes("Docs — https://docs.apify.com"), true);
  assert.equal(rendered.includes("Required"), true);
});
