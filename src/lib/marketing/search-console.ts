import "server-only";

import { GoogleAuth } from "google-auth-library";

type SearchRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type SearchResponse = { rows?: SearchRow[] };
type SearchConsoleRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };
type SearchConsoleResult =
  | { configured: false; error: null }
  | { configured: true; error: string }
  | { configured: true; error: null; startDate: string; endDate: string; clicks: number; impressions: number; ctr: number; position: number; trend: SearchConsoleRow[]; queries: SearchConsoleRow[]; pages: SearchConsoleRow[] };

function config() {
  const raw = process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON;
  const property = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "sc-domain:bizcraw.com";
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!credentials.client_email || !credentials.private_key) return null;
    credentials.private_key = credentials.private_key.replaceAll("\\n", "\n");
    return { credentials, property };
  } catch { return null; }
}

async function query(accessToken: string, property: string, body: Record<string, unknown>) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Search Console returned ${response.status}.`);
  return await response.json() as SearchResponse;
}

export async function loadSearchConsole(days: number): Promise<SearchConsoleResult> {
  const settings = config();
  if (!settings) return { configured: false as const, error: null };
  try {
    const end = new Date(Date.now() - 3 * 86_400_000);
    const start = new Date(end.getTime() - Math.max(1, days - 1) * 86_400_000);
    const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
    const auth = new GoogleAuth({ credentials: settings.credentials, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
    const accessToken = await auth.getAccessToken();
    if (!accessToken) throw new Error("Google did not issue an access token.");
    const [dates, queries, pages] = await Promise.all([
      query(accessToken, settings.property, { startDate, endDate, dimensions: ["date"], rowLimit: 1000 }),
      query(accessToken, settings.property, { startDate, endDate, dimensions: ["query"], rowLimit: 10 }),
      query(accessToken, settings.property, { startDate, endDate, dimensions: ["page"], rowLimit: 10 }),
    ]);
    const dateRows = dates.rows || [];
    const clicks = dateRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const impressions = dateRows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const weightedPosition = dateRows.reduce((sum, row) => sum + Number(row.position || 0) * Number(row.impressions || 0), 0);
    const mapRows = (rows: SearchRow[] | undefined) => (rows || []).map((row) => ({ key: row.keys?.[0] || "Unknown", clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0), ctr: Number(row.ctr || 0), position: Number(row.position || 0) }));
    return { configured: true as const, error: null, startDate, endDate, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? weightedPosition / impressions : 0, trend: mapRows(dateRows), queries: mapRows(queries.rows), pages: mapRows(pages.rows) };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "Search Console could not be loaded." };
  }
}
