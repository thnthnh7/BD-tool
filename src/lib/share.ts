"use client";

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Client, CompanySettings, Quote } from "./types";

export type SharedQuotePayload = {
  settings: CompanySettings;
  client: Client | null;
  quote: Quote;
};

export function encodeSharedQuote(payload: SharedQuotePayload) {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSharedQuote(encoded: string): SharedQuotePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    return json ? (JSON.parse(json) as SharedQuotePayload) : null;
  } catch {
    return null;
  }
}
