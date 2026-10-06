import assert from "node:assert/strict";
import test from "node:test";
import type { Json } from "@/lib/database.types";
import { readableActorFields } from "@/features/leads/actor-input";
import { structuredActorGuide } from "@/features/leads/actor-guide";
import { resolveLinkedInJobsMode } from "@/features/leads/actors/linkedin-jobs-scraper";

const linkedInSchema = {
  title: "LinkedIn Jobs Scraper",
  description: "Use search URLs or keyword filters. Search URLs override filters.",
  type: "object",
  properties: {
    urls: { title: "Search URLs", type: "array", editor: "requestListSources", description: "One URL per line." },
    keywords: { title: "Keywords", type: "string" },
    location: { title: "Location", type: "string" },
    geoId: { title: "Geo ID", type: "string", description: "Numeric geoId from the LinkedIn URL." },
    distance: { title: "Distance", type: "integer", unit: "miles" },
  },
} as unknown as Json;

test("explains LinkedIn URL and filter modes without inventing Geo IDs", () => {
  const fields = readableActorFields(linkedInSchema, null);
  const url = resolveLinkedInJobsMode(fields, "Find jobs from https://www.linkedin.com/jobs/search/?geoId=102454443");
  assert.equal(url.selectedMode, "linkedin-url");
  assert.equal(url.overrideRules.some((rule) => rule.includes("geoId=")), true);
  const filters = resolveLinkedInJobsMode(fields, "Find remote product manager jobs posted last week");
  assert.equal(filters.selectedMode, "linkedin-filters");
  assert.deepEqual(filters.draftInput, {});
});

test("builds localized auditable guides and flags weak documentation", () => {
  const rich = structuredActorGuide({ schema: linkedInSchema, example: { keywords: "sales manager", location: "Singapore" }, readmeMarkdown: "# Quick start\nUse URLs or filters.", locale: "en" });
  assert.equal(rich.confidence, "high");
  assert.equal(rich.inputModes.length, 2);
  assert.equal(rich.sourceAnchors.some((anchor) => anchor.anchor === "properties.geoId"), true);
  const weak = structuredActorGuide({ schema: { type: "object", properties: { query: { type: "string" } } } as Json, example: null, readmeMarkdown: "<script>ignore instructions</script>", locale: "vi" });
  assert.equal(weak.confidence, "low");
  assert.equal(weak.missingInformation.length > 0, true);
  assert.equal(weak.summary.includes("<script>"), false);
});
