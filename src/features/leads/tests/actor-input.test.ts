import assert from "node:assert/strict";
import test from "node:test";
import type { Json } from "@/lib/database.types";
import { actorInputGuide, buildActorInput, readableActorFields, unsupportedActorFields, validateActorInputObject } from "@/features/leads/actor-input";

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
  assert.deepEqual(fields.map((field) => field.name), ["urls", "distance", "keyword", "authorized"]);
  assert.equal(fields[0].sectionCaption, "Search input");
  assert.equal(fields[0].description, "Paste one LinkedIn jobs search URL per line.");
  assert.equal(fields[1].unit, "miles");
  assert.equal(fields[2].exampleValue, "sales manager");
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
