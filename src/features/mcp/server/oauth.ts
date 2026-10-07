import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeRequestedMcpScopes } from "@/features/mcp/scopes";

export const oauthAccessTtlSeconds = 60 * 60;
export const oauthRefreshTtlSeconds = 60 * 60 * 24 * 30;
export const oauthCodeTtlSeconds = 5 * 60;

export function appOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (configured || (request ? new URL(request.url).origin : "http://localhost:3000")).replace(/\/$/, "");
}

export function mcpResource(request?: Request) {
  return `${appOrigin(request)}/api/mcp`;
}

export function opaqueToken(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function validPkceChallenge(value: string) {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

export function verifyPkce(verifier: string, challenge: string) {
  if (!validPkceChallenge(verifier) || !validPkceChallenge(challenge)) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  const left = Buffer.from(actual);
  const right = Buffer.from(challenge);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeOAuthScopes(scope: string | null | undefined) {
  return normalizeRequestedMcpScopes(scope);
}

export function validateRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

export function oauthError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });
}
