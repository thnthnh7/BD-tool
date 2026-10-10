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

function canonicalEmail(value: string) {
  return value.trim().toLowerCase();
}

function canonicalPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return trimmed;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function canonicalUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return value.trim();
  }
}

function identityFingerprint(keys: Record<string, string>) {
  const candidate = ["email", "phone", "external_id", "url", "username"]
    .map((key) => keys[key] ? `${key}:${keys[key]}` : "")
    .find(Boolean);
  return candidate ? createHash("md5").update(candidate).digest("hex") : "";
}

function quality(recordType: DataRecordType, input: { title: string; url: string; email: string; phone: string; description: string; fingerprint: string }) {
  const issues: string[] = [];
  let score = 0;
  if (input.title && !/^Record \d+$/.test(input.title)) score += 20; else issues.push("missing_title");
  if (input.fingerprint) score += 25; else issues.push("missing_identity");
  if (input.url) score += 20; else issues.push("missing_url");
  if (input.description) score += 10; else issues.push("missing_description");
  if (input.email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) score += 15;
    else issues.push("invalid_email");
  }
  if (input.phone) score += 10;
  if (["person_profile", "organization", "place", "generic_record"].includes(recordType) && !input.email && !input.phone && !input.url) {
    issues.push("missing_contact_channel");
  }
  return { score: Math.min(100, score), issues };
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
  const recordType = forcedType || inferRecordType(raw);
  const title = text(raw.title, raw.name, raw.fullName, raw.full_name, raw.username, raw.companyName, raw.company_name, raw.query, raw.url) || `Record ${index + 1}`;
  const url = canonicalUrl(text(raw.url, raw.link, raw.profileUrl, raw.profile_url, raw.website, raw.webUrl, raw.web_url));
  const email = canonicalEmail(text(raw.email, Array.isArray(raw.emails) ? raw.emails[0] : ""));
  const phone = canonicalPhone(text(raw.phone, raw.phoneNumber, raw.phone_number));
  const username = text(raw.username, raw.handle).toLowerCase().replace(/^@/, "");
  const externalId = text(raw.id, raw.externalId, raw.external_id, raw.placeId, raw.place_id);
  const description = text(raw.description, raw.biography, raw.bio, raw.snippet, raw.text, raw.caption);
  const normalizedData = {
    title,
    url,
    email,
    phone,
    username,
    domain: (() => { try { return new URL(url).hostname; } catch { return ""; } })(),
    description,
    image_url: text(raw.imageUrl, raw.image_url, raw.profilePicUrl, raw.profile_pic_url, raw.thumbnailUrl),
  };
  const identityKeys = Object.fromEntries(Object.entries({ external_id: externalId, url, email, phone, username }).filter(([, item]) => item));
  const fingerprint = identityFingerprint(identityKeys);
  const recordQuality = quality(recordType, { title, url, email, phone, description, fingerprint });
  const rawData = raw as Json;
  return {
    recordType,
    title: title.slice(0, 300),
    canonicalUrl: url.slice(0, 2000),
    normalizedData: normalizedData as Json,
    rawData,
    identityKeys: identityKeys as Json,
    identityFingerprint: fingerprint,
    qualityScore: recordQuality.score,
    qualityIssues: recordQuality.issues,
    contentHash: createHash("sha256").update(JSON.stringify(raw)).digest("hex"),
  };
}

