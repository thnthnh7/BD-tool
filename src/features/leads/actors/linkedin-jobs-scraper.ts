import type { ActorField } from "@/features/leads/actor-input";

export const LINKEDIN_JOBS_SLUG = "curious_coder/linkedin-jobs-scraper";

function findField(fields: ActorField[], patterns: RegExp[]) {
  return fields.find((field) => patterns.some((pattern) => pattern.test(`${field.name} ${field.label}`)));
}

export function resolveLinkedInJobsMode(fields: ActorField[], goal: string) {
  const urls = goal.match(/https?:\/\/[^\s)]+/g) || [];
  const urlField = findField(fields, [/(search|start).*url/i, /\burls?\b/i]);
  const keywordField = findField(fields, [/keyword/i, /search.*term/i]);
  const locationField = findField(fields, [/location/i]);
  const geoIdField = findField(fields, [/geo.*id/i]);
  const distanceField = findField(fields, [/distance|radius/i]);
  const selectedMode = urls.length && urlField ? "linkedin-url" : "linkedin-filters";
  return {
    selectedMode,
    reason: selectedMode === "linkedin-url"
      ? "A complete LinkedIn Jobs URL was provided. URL mode overrides keyword, location, Geo ID and distance fields."
      : "No complete LinkedIn Jobs URL was provided. Use keywords and location; Geo ID is optional.",
    draftInput: selectedMode === "linkedin-url" && urlField ? { [urlField.name]: urls.map((url) => ({ url })) } : {},
    overrideRules: [
      "When the URL field has a value, keyword, location, Geo ID and distance fields are ignored.",
      "Geo ID is the numeric value after geoId= in a LinkedIn Jobs search URL.",
      "Distance is a radius in miles; leave it empty to use LinkedIn's default.",
    ],
    primaryFields: [urlField, keywordField, locationField, geoIdField, distanceField]
      .filter((field): field is ActorField => Boolean(field))
      .map((field) => field.name),
  };
}
