export const MCP_SERVER_VERSION = "1.1.0";
export const MCP_TOOL_SCHEMA_VERSION = "2026-09-30";
export const MCP_MINIMUM_SUPPORTED_SCHEMA_VERSION = "2026-09-28";
export const MCP_DEPRECATION_WINDOW_DAYS = 90;

export type McpDeprecation = { name: string; replacement: string | null; announcedAt: string; removalAfter: string };
export const MCP_DEPRECATIONS: McpDeprecation[] = [
  { name: "resource:leadely://workspace/{workspaceId}/profile", replacement: "resource:bizcraw://workspace/{workspaceId}/profile", announcedAt: "2026-09-30", removalAfter: "2026-12-29" },
  { name: "resource:leadely://schemas/crm", replacement: "resource:bizcraw://schemas/crm", announcedAt: "2026-09-30", removalAfter: "2026-12-29" },
];

export function mcpCapabilities() {
  return {
    serverVersion: MCP_SERVER_VERSION,
    toolSchemaVersion: MCP_TOOL_SCHEMA_VERSION,
    minimumSupportedSchemaVersion: MCP_MINIMUM_SUPPORTED_SCHEMA_VERSION,
    deprecationWindowDays: MCP_DEPRECATION_WINDOW_DAYS,
    compatibilityPolicy: "Additive changes remain within the current major version. Breaking tool or input changes require a new major server version and a deprecation window.",
    deprecations: MCP_DEPRECATIONS,
  };
}
