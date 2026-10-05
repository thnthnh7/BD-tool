export const MODULE_GROUPS = [
  {
    id: "find",
    label: "Find",
    modules: [
      ["sources", "Sources"],
      ["scraping", "Scraping"],
      ["data_library", "Data Library"],
      ["leads", "Leads"],
      ["lists", "Lists"],
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

export type ModuleKey = (typeof MODULE_GROUPS)[number]["modules"][number][0];

export const MODULE_KEYS = MODULE_GROUPS.flatMap((group) => group.modules.map(([key]) => key)) as ModuleKey[];

export const CAPABILITY_OPTIONS = [
  ["byok_ai", "BYOK AI"],
  ["ai_agent", "AI Agent"],
  ["export_docx", "Document export"],
  ["custom_branding", "Custom branding"],
] as const;

export type CapabilityKey = (typeof CAPABILITY_OPTIONS)[number][0];
export type PlanFeatureKey = ModuleKey | CapabilityKey | "lead_scrape";
