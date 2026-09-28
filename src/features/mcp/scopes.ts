export const mcpScopes = ["workspace:read", "crm:read", "crm:write", "sources:read", "data:read", "knowledge:read", "quotes:read", "quotes:write", "scrape:read", "scrape:write"] as const;
export type McpScope = (typeof mcpScopes)[number];

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
