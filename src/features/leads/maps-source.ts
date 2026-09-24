export const MAPS_SLUG = "compass/crawler-google-places";
export const MAPS_APIFY_ID = "nwua9Gu5YrADL7ZDj";

export function isMapsActor(slugOrId: string | null | undefined) {
  if (!slugOrId) return false;
  return slugOrId.replaceAll("~", "/") === MAPS_SLUG;
}

export function apifyActorPath(slug: string) {
  return slug.replaceAll("/", "~");
}
