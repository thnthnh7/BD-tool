import assert from "node:assert/strict";
import { MCP_DEPRECATIONS, MCP_DEPRECATION_WINDOW_DAYS, MCP_MINIMUM_SUPPORTED_SCHEMA_VERSION, MCP_SERVER_VERSION, MCP_TOOL_SCHEMA_VERSION, mcpCapabilities } from "../src/features/mcp/server/version";

assert.match(MCP_SERVER_VERSION, /^\d+\.\d+\.\d+$/);
assert.match(MCP_TOOL_SCHEMA_VERSION, /^\d{4}-\d{2}-\d{2}$/);
assert.match(MCP_MINIMUM_SUPPORTED_SCHEMA_VERSION, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(MCP_MINIMUM_SUPPORTED_SCHEMA_VERSION <= MCP_TOOL_SCHEMA_VERSION);
assert.ok(MCP_DEPRECATION_WINDOW_DAYS >= 30);
assert.equal(new Set(MCP_DEPRECATIONS.map((item) => item.name)).size, MCP_DEPRECATIONS.length);
for (const item of MCP_DEPRECATIONS) {
  assert.match(item.announcedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(item.removalAfter, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(item.removalAfter > item.announcedAt);
  const windowDays = (Date.parse(item.removalAfter) - Date.parse(item.announcedAt)) / 86_400_000;
  assert.ok(windowDays >= MCP_DEPRECATION_WINDOW_DAYS);
  assert.ok(item.replacement);
}
assert.deepEqual(mcpCapabilities().deprecations, MCP_DEPRECATIONS);
console.log(`MCP contract ${MCP_SERVER_VERSION} / ${MCP_TOOL_SCHEMA_VERSION} passed.`);
