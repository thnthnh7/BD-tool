import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Client, CompanySettings, Quote } from "./types";

export type SharedQuotePayload = {
  settings: CompanySettings;
  client: Client | null;
  quote: Quote;
};

/** Prepare share payload. Strip data-URI logos only for long ?data= URLs. */
export function slimSharedPayload(
  payload: SharedQuotePayload,
  options?: { stripDataLogos?: boolean },
): SharedQuotePayload {
  const stripDataLogos = options?.stripDataLogos ?? true;
  const client = payload.client
    ? {
        ...payload.client,
        logoUrl:
          stripDataLogos && payload.client.logoUrl?.startsWith("data:")
            ? undefined
            : payload.client.logoUrl,
      }
    : null;

  return {
    settings: payload.settings,
    client,
    quote: payload.quote,
  };
}

export function encodeSharedQuote(payload: SharedQuotePayload) {
  return compressToEncodedURIComponent(JSON.stringify(slimSharedPayload(payload, { stripDataLogos: true })));
}

export function decodeSharedQuote(encoded: string): SharedQuotePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    return json ? (JSON.parse(json) as SharedQuotePayload) : null;
  } catch {
    return null;
  }
}
