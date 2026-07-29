import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Client, CompanySettings, Quote } from "./types";

export type SharedQuotePayload = {
  settings: CompanySettings;
  client: Client | null;
  quote: Quote;
};

/** Drop bulky data-URI logos so share storage/URLs stay small. */
export function slimSharedPayload(payload: SharedQuotePayload): SharedQuotePayload {
  const client = payload.client
    ? {
        ...payload.client,
        logoUrl: payload.client.logoUrl?.startsWith("data:") ? undefined : payload.client.logoUrl,
      }
    : null;

  return {
    settings: payload.settings,
    client,
    quote: payload.quote,
  };
}

export function encodeSharedQuote(payload: SharedQuotePayload) {
  return compressToEncodedURIComponent(JSON.stringify(slimSharedPayload(payload)));
}

export function decodeSharedQuote(encoded: string): SharedQuotePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    return json ? (JSON.parse(json) as SharedQuotePayload) : null;
  } catch {
    return null;
  }
}
