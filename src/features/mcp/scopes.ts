export const mcpScopes = ["workspace:read", "crm:read", "crm:write", "sources:read", "data:read", "knowledge:read", "quotes:read", "quotes:write", "scrape:read", "scrape:write"] as const;
export type McpScope = (typeof mcpScopes)[number];

export const mcpDefaultScopes: McpScope[] = ["workspace:read", "crm:read"];
export const mcpOAuthScopes = [...mcpScopes, "offline_access"] as const;

export function normalizeRequestedMcpScopes(scope: string | null | undefined): McpScope[] {
  const requested = new Set((scope || "").split(/\s+/).filter(Boolean));
  return requested.size ? mcpScopes.filter((item) => requested.has(item)) : [...mcpDefaultScopes];
}

export const mcpScopeLabelKeys: Record<McpScope, string> = {
  "workspace:read": "scopeWorkspace",
  "crm:read": "scopeCrm",
  "crm:write": "scopeCrmWrite",
  "sources:read": "scopeSources",
  "data:read": "scopeData",
  "knowledge:read": "scopeKnowledge",
  "quotes:read": "scopeQuotes",
  "quotes:write": "scopeQuotesWrite",
  "scrape:read": "scopeScrape",
  "scrape:write": "scopeScrapeWrite",
};
