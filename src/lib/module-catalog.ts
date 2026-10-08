export const MODULE_GROUPS = [
  {
    id: "find",
    label: "Find",
    modules: [
      ["sources", "Sources"],
      ["scraping", "Scraping"],
      ["leads", "Leads"],
    ],
  },
  {
    id: "crm",
    label: "CRM",
    modules: [
      ["companies", "Companies"],
      ["contacts", "Contacts"],
      ["deals", "Deals"],
      ["tasks", "Tasks"],
    ],
  },
  {
    id: "sell",
    label: "Sell",
    modules: [
      ["quotes", "Quotes"],
      ["product_modules", "Product modules"],
      ["contracts", "Contracts"],
    ],
  },
  {
    id: "engage",
    label: "Engage",
    modules: [
      ["inbox", "Inbox"],
      ["calendar", "Calendar"],
      ["sequences", "Sequences"],
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    modules: [
      ["team", "Team"],
      ["crm_integrations", "CRM integrations"],
      ["mcp_access", "MCP"],
    ],
  },
] as const;

// These capabilities remain part of the entitlement contract for existing
// subscriptions and internal services, but do not represent standalone UI
// modules that customers need to configure.
export const INTERNAL_MODULE_KEYS = ["data_library", "lists"] as const;

export type ModuleKey =
  | (typeof MODULE_GROUPS)[number]["modules"][number][0]
  | (typeof INTERNAL_MODULE_KEYS)[number];

export const MODULE_KEYS = [
  ...MODULE_GROUPS.flatMap((group) => group.modules.map(([key]) => key)),
  ...INTERNAL_MODULE_KEYS,
] as ModuleKey[];

export const CAPABILITY_OPTIONS = [
  ["byok_ai", "BYOK AI"],
  ["ai_agent", "AI Agent"],
  ["export_docx", "Document export"],
] as const;

export type CapabilityKey = (typeof CAPABILITY_OPTIONS)[number][0];
export type PlanFeatureKey = ModuleKey | CapabilityKey | "lead_scrape";
