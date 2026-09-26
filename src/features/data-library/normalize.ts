import { createHash } from "node:crypto";
import type { Json } from "@/lib/database.types";

export const DATA_RECORD_TYPES = [
  "person_profile", "organization", "place", "social_content", "job_listing",
  "product_listing", "review", "web_page", "search_result", "media_asset",
  "document", "generic_record",
] as const;

export type DataRecordType = (typeof DATA_RECORD_TYPES)[number];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(keys: Set<string>, candidates: string[]) {
  return candidates.some((key) => keys.has(key));
}

export function inferRecordType(value: unknown): DataRecordType {
  const raw = record(value);
  const keys = new Set(Object.keys(raw).map((key) => key.toLowerCase()));
  const url = text(raw.url, raw.link, raw.profileUrl, raw.profile_url).toLowerCase();
  if (includesAny(keys, ["jobtitle", "job_title", "salary", "employmenttype", "employment_type", "hiringorganization"])) return "job_listing";
  if (includesAny(keys, ["price", "sku", "productid", "product_id", "availability"])) return "product_listing";
  if (includesAny(keys, ["reviewtext", "review_text", "reviewrating", "review_rating", "stars"])) return "review";
  if (includesAny(keys, ["username", "followerscount", "followers_count", "biography", "profilepicurl", "profile_pic_url"])) return "person_profile";
  if (includesAny(keys, ["caption", "hashtags", "likescount", "likes_count", "commentscount", "comments_count", "retweetcount"])) return "social_content";
  if (includesAny(keys, ["placeid", "place_id", "address", "latitude", "longitude", "location"])) return "place";
  if (includesAny(keys, ["companyname", "company_name", "organization", "domain", "industry", "employeescount"])) return "organization";
  if (includesAny(keys, ["searchquery", "search_query", "position", "snippet"])) return "search_result";
  if (/\.(pdf|docx?|xlsx?|csv)(\?|$)/i.test(url)) return "document";
  if (/\.(png|jpe?g|gif|webp|mp4|mov|mp3|wav)(\?|$)/i.test(url)) return "media_asset";
  if (includesAny(keys, ["html", "markdown", "text", "title"]) && url) return "web_page";
  return "generic_record";
}

export function normalizeDataRecord(value: unknown, index: number, forcedType?: DataRecordType) {
  const raw = record(value);
  const title = text(raw.title, raw.name, raw.fullName, raw.full_name, raw.username, raw.companyName, raw.company_name, raw.query, raw.url) || `Record ${index + 1}`;
  const canonicalUrl = text(raw.url, raw.link, raw.profileUrl, raw.profile_url, raw.website, raw.webUrl, raw.web_url);
  const email = text(raw.email, Array.isArray(raw.emails) ? raw.emails[0] : "");
  const phone = text(raw.phone, raw.phoneNumber, raw.phone_number);
  const username = text(raw.username, raw.handle);
  const externalId = text(raw.id, raw.externalId, raw.external_id, raw.placeId, raw.place_id);
  const normalizedData = {
    title,
    url: canonicalUrl,
    email,
    phone,
    username,
    description: text(raw.description, raw.biography, raw.bio, raw.snippet, raw.text, raw.caption),
    image_url: text(raw.imageUrl, raw.image_url, raw.profilePicUrl, raw.profile_pic_url, raw.thumbnailUrl),
  };
  const identityKeys = Object.fromEntries(Object.entries({ external_id: externalId, url: canonicalUrl, email, phone, username }).filter(([, item]) => item));
  const rawData = raw as Json;
  return {
    recordType: forcedType || inferRecordType(raw),
    title: title.slice(0, 300),
    canonicalUrl: canonicalUrl.slice(0, 2000),
    normalizedData: normalizedData as Json,
    rawData,
    identityKeys: identityKeys as Json,
    contentHash: createHash("sha256").update(JSON.stringify(raw)).digest("hex"),
  };
}

