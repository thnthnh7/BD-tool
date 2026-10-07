export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  path?: string;
  target?: string;
  entryPath?: string;
  fallbackTargets?: string[];
  triggerTarget?: string;
  openAgent?: boolean;
  externalUrl?: string;
  actionLabel?: string;
  aiPrompt?: string;
};

export type TutorialChapter = {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string;
  feature?: string;
  roles?: string[];
  steps: TutorialStep[];
};

export const tutorialChapters: TutorialChapter[] = [
  {
    id: "workspace",
    number: 1,
    title: "Meet your workspace",
    description: "Learn where to find data sources, scraping runs and customer records.",
    duration: "2 min",
    steps: [
      { id: "dashboard", title: "Your workspace at a glance", body: "The dashboard summarizes sales activity, pipeline, tasks and recent records. It becomes more useful as your team adds data and works opportunities.", path: "/app", target: "workspace-content" },
      { id: "find", title: "Find new market data", body: "Sources is where you choose scraping tools. Scrape is where you start runs, monitor progress and review run history.", target: "nav-group-find" },
      { id: "crm", title: "Turn useful data into sales records", body: "Leads are prospects to qualify. Companies and contacts hold customer context. Deals and tasks help your team move opportunities forward.", target: "nav-group-crm" },
      { id: "tools", title: "Continue the workflow", body: "Your plan may also include sales, engagement and workspace tools. The guidebook shows only chapters available to your role and plan.", target: "nav-group-sell" },
    ],
  },
  {
    id: "apify",
    number: 2,
    title: "Connect Apify",
    description: "Connect the account Bizcraw uses to run Actors and retrieve results.",
    duration: "4 min",
    roles: ["owner", "admin"],
    steps: [
      { id: "why", title: "Connect the scraping engine", body: "Bizcraw uses Apify Actors to collect public web data. Your Apify account owns the Actor runs, usage and generated datasets.", path: "/app/settings?section=apify", target: "settings-apify" },
      { id: "account", title: "Create your Apify account", body: "Create an account with email, Google or GitHub. If you already have an account, sign in instead. Email sign-up may require verification.", externalUrl: "https://console.apify.com/sign-up", actionLabel: "Open Apify sign-up" },
      { id: "integrations", title: "Open API & Integrations", body: "In Apify Console, open Settings → API & Integrations. This is where Apify manages API tokens and connected services.", externalUrl: "https://console.apify.com/account#/integrations", actionLabel: "Open API & Integrations" },
      { id: "token", title: "Create a token for Bizcraw", body: "Create a separate token named “Bizcraw”. Allow Actor runs and access to datasets and storage created by those runs. Use only the permissions this integration needs." },
      { id: "paste", title: "Connect the account", body: "Return to Bizcraw Settings, paste the token into the secure Apify field and select Verify and connect. Never paste an API token into AI chat.", path: "/app/settings?section=apify", target: "settings-apify" },
      { id: "confirm", title: "Confirm the connection", body: "Check the connected account name, plan and usage before choosing a source.", path: "/app/settings?section=apify", target: "settings-apify" },
    ],
  },
  {
    id: "sources",
    number: 3,
    title: "Choose a source",
    description: "Find an Actor whose output matches the data you need.",
    duration: "3 min",
    feature: "sources",
    steps: [
      { id: "browse", title: "Browse available sources", body: "Each source is an Apify Actor with its own input fields, output structure and pricing. Start from the data you need, not only the website name.", path: "/app/leads/sources", target: "sources-page" },
      { id: "filter", title: "Find the right Actor", body: "Search by platform or outcome, then narrow the catalog by category. Try Google Maps, LinkedIn jobs, Instagram profiles or company contacts.", path: "/app/leads/sources", target: "sources-filters" },
      { id: "review", title: "Review coverage and cost", body: "Check what the Actor collects, its input requirements and pricing events. Returned fields and final Apify cost depend on the Actor and selected options.", path: "/app/leads/sources", target: "sources-catalog" },
      { id: "install", title: "Add a source to your workspace", body: "Install an Actor so your team can use it from Scrape. Removing it later does not delete completed run history.", path: "/app/leads/sources", target: "sources-catalog" },
    ],
  },
  {
    id: "first-scrape",
    number: 4,
    title: "Run your first scrape",
    description: "Configure one Actor safely and understand what happens before it starts.",
    duration: "5 min",
    feature: "scraping",
    steps: [
      { id: "select", title: "Choose what will run", body: "Select an installed source. The form changes because every Actor accepts different inputs.", path: "/app/leads/scrape/new", target: "scrape-source-picker" },
      { id: "guide", title: "Understand the required inputs", body: "Start with the quick guide: what this Actor collects, what you must provide and one working example. Open field help only when you need more detail.", path: "/app/leads/scrape/new", target: "scrape-actor-form", aiPrompt: "Explain how to use the selected Actor. Tell me what is required, give me a safe first-run example and warn me about options that may increase cost." },
      { id: "required", title: "Enter the minimum valid input", body: "Required fields are marked. Use the example as a format guide, replace it with your target and leave optional fields unchanged for the first run.", path: "/app/leads/scrape/new", target: "scrape-actor-form" },
      { id: "scope", title: "Start small", body: "Use a small result limit for your first run. Review the pricing model and paid add-ons before spending Apify usage.", path: "/app/leads/scrape/new", target: "scrape-actor-form" },
      { id: "start", title: "Run the Actor", body: "Starting the run sends your inputs to Apify. You can leave the page and follow progress from Scrape.", path: "/app/leads/scrape/new", target: "scrape-actor-form" },
    ],
  },
  {
    id: "results",
    number: 5,
    title: "Monitor and review results",
    description: "Follow a run, inspect its dataset and import only useful records.",
    duration: "4 min",
    feature: "scraping",
    steps: [
      { id: "history", title: "Every run stays traceable", body: "Run history shows the Actor, creator, status, records, Apify cost and creation time. Use filters to find earlier work.", path: "/app/leads/scrape", target: "scrape-history" },
      { id: "monitor", title: "Monitor or cancel a run", body: "Open a running job to check progress. Cancel it if it is incorrect, stuck or no longer needed so the workspace can start another run.", path: "/app/leads/scrape", target: "scrape-history" },
      { id: "dataset", title: "Inspect returned records", body: "Open a completed run, then search, sort and inspect its fields. Review nested data before selecting anything for CRM import.", path: "/app/leads/scrape", target: "scrape-history" },
      { id: "select", title: "Keep only relevant data", body: "Open a completed run, review the Results tab and keep only records that match your target market and data-quality rules. Unselected results remain attached to the run.", entryPath: "/app/leads/scrape", target: "scrape-results", fallbackTargets: ["scrape-history"] },
      { id: "import", title: "Create CRM records", body: "Open a completed run and select the CRM import tab. Import selected results to create or connect supported company, contact and lead records while preserving source context. If the tab is unavailable, that Actor is dataset-only; choose a CRM-supported source such as Google Maps Scraper.", entryPath: "/app/leads/scrape", target: "scrape-crm-import", fallbackTargets: ["scrape-results", "scrape-history"] },
    ],
  },
  {
    id: "crm",
    number: 6,
    title: "Work a lead",
    description: "Understand CRM records and turn a qualified prospect into an opportunity.",
    duration: "10 min",
    feature: "leads",
    steps: [
      { id: "leads", title: "Open a lead", body: "Leads are prospects your team is evaluating. Bizcraw opens the first available lead so you can review the full workflow.", entryPath: "/app/leads", target: "lead-detail-overview", triggerTarget: "tutorial-open-first-lead", fallbackTargets: ["leads-list"] },
      { id: "lead-overview", title: "Maintain lead status and ownership", body: "Keep the linked company, contact, source and status accurate so the team knows who this prospect is and where it came from.", entryPath: "/app/leads", target: "lead-detail-overview", fallbackTargets: ["leads-list"] },
      { id: "lead-qualify", title: "Convert a qualified lead", body: "When the prospect is ready, create a deal with a pipeline, stage, expected value and close date. This preserves the lead while creating an opportunity to manage.", entryPath: "/app/leads", target: "lead-detail-qualify", fallbackTargets: ["leads-list"] },
      { id: "lead-activity", title: "Record the conversation", body: "Add notes and other activity so the next person understands what happened and what should happen next.", entryPath: "/app/leads", target: "lead-detail-activity", fallbackTargets: ["leads-list"] },
      { id: "companies", title: "Open a company", body: "Companies keep organization-level context together. Bizcraw opens the first available company to show its profile and connected records.", entryPath: "/app/companies", target: "company-detail-overview", triggerTarget: "tutorial-open-first-company", fallbackTargets: ["companies-list"] },
      { id: "company-overview", title: "Maintain the account profile", body: "Keep identity, lifecycle, website, domain and contact details current. This information is reused across CRM and commercial work.", entryPath: "/app/companies", target: "company-detail-overview", fallbackTargets: ["companies-list"] },
      { id: "company-activity", title: "Build account history", body: "Record calls, meetings and notes on the company so account context remains available to the whole team.", entryPath: "/app/companies", target: "company-detail-activity", fallbackTargets: ["companies-list"] },
      { id: "company-relations", title: "See people and opportunities together", body: "The company detail connects its contacts and deals. Use these sections to understand stakeholders and active commercial work.", entryPath: "/app/companies", target: "company-detail-relations", fallbackTargets: ["companies-list"] },
      { id: "company-plan", title: "Turn account context into a plan", body: "Use the account plan to capture goals, risks, stakeholders and the next actions for strategic accounts.", entryPath: "/app/companies", target: "company-detail-plan", fallbackTargets: ["companies-list"] },
      { id: "contacts", title: "Open a contact", body: "Contacts represent the people associated with an account. Bizcraw opens the first available contact to review the person in detail.", entryPath: "/app/contacts", target: "contact-detail-overview", triggerTarget: "tutorial-open-first-contact", fallbackTargets: ["contacts-list"] },
      { id: "contact-overview", title: "Keep contact details usable", body: "Maintain name, role, email, phone, LinkedIn, company and relationship strength before outreach.", entryPath: "/app/contacts", target: "contact-detail-overview", fallbackTargets: ["contacts-list"] },
      { id: "contact-activity", title: "Preserve relationship context", body: "Log important notes and interactions so future follow-up starts with the full relationship history.", entryPath: "/app/contacts", target: "contact-detail-activity", fallbackTargets: ["contacts-list"] },
      { id: "deals", title: "Open a deal", body: "A deal is a qualified opportunity. Bizcraw opens the first available deal to show its stage, commercial work and stakeholders.", entryPath: "/app/deals", target: "deal-detail-health", triggerTarget: "tutorial-open-first-deal", fallbackTargets: ["deals-list"] },
      { id: "deal-health", title: "Read opportunity health", body: "Stage, probability, weighted value, close date and stakeholder coverage show whether the opportunity is progressing realistically.", entryPath: "/app/deals", target: "deal-detail-health", fallbackTargets: ["deals-list"] },
      { id: "deal-timeline", title: "Keep a decision history", body: "Log calls, meetings and notes in the timeline so the opportunity can be understood without relying on memory.", entryPath: "/app/deals", target: "deal-detail-timeline", fallbackTargets: ["deals-list"] },
      { id: "deal-next", title: "Always define the next step", body: "Create and complete the next task, or ask AI for an insight when you need help deciding how to advance the deal.", entryPath: "/app/deals", target: "deal-detail-next", fallbackTargets: ["deals-list"] },
      { id: "deal-commercial", title: "Connect quotes and contracts", body: "Create quotes and review contracts from the deal so pricing, revisions and signed terms stay attached to the opportunity.", entryPath: "/app/deals", target: "deal-detail-commercial", fallbackTargets: ["deals-list"] },
      { id: "deal-people", title: "Map the buying group", body: "Add stakeholders and identify roles such as decision maker, champion and economic buyer before forecasting the deal.", entryPath: "/app/deals", target: "deal-detail-people", fallbackTargets: ["deals-list"] },
      { id: "deal-details", title: "Review the core deal record", body: "Use the details panel to confirm company, deal type, priority and description, then edit any stale information.", entryPath: "/app/deals", target: "deal-detail-details", fallbackTargets: ["deals-list"] },
      { id: "tasks", title: "Every opportunity needs a next step", body: "Create a task with an owner and due date so the opportunity does not stop after qualification.", path: "/app/tasks", target: "nav-tasks" },
    ],
  },
  {
    id: "quotes", number: 7, title: "Quotes", description: "Build a quote from brief to final preview.", duration: "6 min", feature: "quotes",
    steps: [
      { id: "list", title: "Open or create a quote", body: "The quote list keeps drafts, revisions, recipients, status and total value together. Bizcraw opens the first available quote; if none exists, use New quote.", entryPath: "/app/quotes", target: "quote-editor-tabs", triggerTarget: "tutorial-open-first-quote", fallbackTargets: ["quotes-list"] },
      { id: "brief", title: "Brief & client", body: "Select the client and project type, describe the work, or paste requirements into AI Brief. Review every generated suggestion before applying it.", path: "/app/quotes/new", target: "quote-step-brief", triggerTarget: "quote-tab-brief", fallbackTargets: ["quote-editor-tabs"] },
      { id: "catalog", title: "Catalog", body: "Choose approved modules from the catalog, add custom line items when needed, and confirm quantity and unit price before continuing.", path: "/app/quotes/new", target: "quote-step-catalog", triggerTarget: "quote-tab-catalog", fallbackTargets: ["quote-editor-tabs"] },
      { id: "commercial", title: "Commercial", body: "Set validity, contract reference, delivery timeline, next steps, warranty and recurring maintenance terms.", path: "/app/quotes/new", target: "quote-step-commercial", triggerTarget: "quote-tab-commercial", fallbackTargets: ["quote-editor-tabs"] },
      { id: "preview", title: "Preview and deliver", body: "Review the final proposal, totals and recipient context before exporting, sharing or marking the quote as sent.", path: "/app/quotes/new", target: "quote-step-preview", triggerTarget: "quote-tab-preview", fallbackTargets: ["quote-editor-tabs"] },
    ],
  },
  {
    id: "modules", number: 8, title: "Modules & knowledge", description: "Maintain the catalog and the knowledge used by AI.", duration: "5 min", feature: "product_modules",
    steps: [
      { id: "catalog", title: "Catalog", body: "Create reusable products and services with a clear name, category, description and suggested price. Quotes reuse this approved catalog.", path: "/app/modules", target: "modules-catalog", triggerTarget: "modules-tab-catalog", fallbackTargets: ["modules-tabs"] },
      { id: "knowledge", title: "Knowledge Files power RAG", body: "Upload approved PDF, DOCX, XLSX, CSV or TXT files. Bizcraw indexes their content so AI can retrieve relevant evidence when preparing accurate quote suggestions.", path: "/app/modules", target: "modules-knowledge", triggerTarget: "modules-tab-knowledge", fallbackTargets: ["modules-tabs"], aiPrompt: "Explain how Knowledge Files and RAG work in Bizcraw, what files I should upload, and how to keep the knowledge base accurate." },
      { id: "review", title: "Review AI-extracted modules", body: "Needs review contains module drafts extracted from knowledge files. Approve only accurate, reusable items and skip duplicates or unsupported suggestions.", path: "/app/modules", target: "modules-review", triggerTarget: "modules-tab-review", fallbackTargets: ["modules-tabs"] },
    ],
  },
  {
    id: "contracts", number: 9, title: "Contracts", description: "Create, connect and maintain contract records.", duration: "4 min", feature: "contracts",
    steps: [
      { id: "create", title: "Create a contract", body: "Give the contract a clear title, connect it to a deal and quote, choose its status, and optionally attach the DOCX file.", path: "/app/contracts", target: "contracts-create" },
      { id: "list", title: "Track every contract", body: "The contract list shows the related deal, quote, status and file. Use it to find draft, sent, signed or void agreements.", path: "/app/contracts", target: "contracts-list" },
      { id: "edit", title: "Update terms and files", body: "Open the pencil action on a contract to update status or notes, upload a DOCX, or generate a document from the connected quote.", path: "/app/contracts", target: "contract-editor", triggerTarget: "contract-edit-trigger", fallbackTargets: ["contract-edit-trigger", "contracts-list"] },
    ],
  },
  {
    id: "mcp",
    number: 14,
    title: "Connect an AI client",
    description: "Use Bizcraw tools safely from ChatGPT and other MCP clients.",
    duration: "6 min",
    feature: "mcp_access",
    roles: ["owner", "admin"],
    steps: [
      { id: "overview", title: "Understand the MCP workspace", body: "MCP lets an approved AI client use Bizcraw tools on behalf of your workspace. Every connection is limited by its scopes, plan access and workspace membership.", path: "/app/mcp", target: "mcp-page" },
      { id: "oauth", title: "Connect ChatGPT with OAuth", body: "For ChatGPT, keep ChatGPT selected, open its connector settings and enter the Bizcraw server URL. Bizcraw will ask you to sign in, review the requested scopes and authorize this workspace. You do not need to create or paste a token.", path: "/app/mcp", target: "mcp-oauth-setup", triggerTarget: "mcp-client-chatgpt", fallbackTargets: ["mcp-client-guide"] },
      { id: "server-url", title: "Use the production server URL", body: "Use https://bizcraw.com/api/mcp as the server URL. The client discovers Bizcraw OAuth automatically; never add a different domain or share credentials in chat.", path: "/app/mcp", target: "mcp-server-config", triggerTarget: "mcp-client-chatgpt", fallbackTargets: ["mcp-client-guide"] },
      { id: "token", title: "Connect clients that require a token", body: "For Claude, Cursor, Codex or another client that cannot complete OAuth, create a named connection with the shortest practical expiry and only the scopes it needs. Copy the token immediately because Bizcraw stores only its hash.", path: "/app/mcp", target: "mcp-token-form", fallbackTargets: ["mcp-connections"] },
      { id: "verify", title: "Verify the connection", body: "Ask the connected client: “What Bizcraw workspace am I connected to?” A successful answer should call get_workspace. Return here and confirm that Last used or Recent calls has updated.", path: "/app/mcp", target: "mcp-verify-connection", triggerTarget: "mcp-client-chatgpt", fallbackTargets: ["mcp-recent-calls"] },
      { id: "approvals", title: "Approve sensitive actions", body: "Paid or externally meaningful actions create a pending request instead of running immediately. Review the action, workspace context and inputs here before approving or rejecting it.", path: "/app/mcp", target: "mcp-approval-queue" },
      { id: "audit", title: "Review and revoke access", body: "Recent calls show which tools the AI client used and whether they succeeded. Rotate a token after moving it to another device, and revoke any connection you no longer trust.", path: "/app/mcp", target: "mcp-recent-calls", fallbackTargets: ["mcp-connections"] },
    ],
  },
  {
    id: "agent", number: 15, title: "AI Agent", description: "Use page-aware guidance and review proposed actions safely.", duration: "3 min", feature: "ai_agent",
    steps: [
      { id: "open", title: "Meet your AI Agent", body: "The Agent opens beside your workspace and understands which Bizcraw page you are viewing. Ask for an explanation, a recommendation or help completing the current workflow.", path: "/app", target: "agent-panel", openAgent: true },
      { id: "starters", title: "Start with a guided question", body: "Choose a starter to launch a tutorial, connect Apify, understand Bizcraw or ask what to do on the current page. You can also write your own question.", path: "/app", target: "agent-starters", fallbackTargets: ["agent-panel"], openAgent: true },
      { id: "composer", title: "Ask in page context", body: "Type a specific goal in the message box. The Agent can explain accessible workspace data and propose next actions. Review any proposed write operation before confirming it.", path: "/app", target: "agent-composer", fallbackTargets: ["agent-panel"], openAgent: true },
    ],
  },
  ...[
    ["engagement", 10, "Engagement tools", "Understand inbox, calendar and follow-up sequences.", "inbox", "/app/inbox", "Inbox records supported communication activity. Calendar stores meetings. Sequences organize repeatable follow-up when enabled."],
    ["team", 11, "Team and settings", "Configure workspace identity, access and connected services.", "team", "/app/settings", "Owners and admins manage workspace settings and invitations. Store API keys only in their dedicated secure fields."],
    ["billing", 12, "Billing and plan access", "Understand subscriptions, seats, modules and usage limits.", undefined, "/app/billing", "Bizcraw plan access and Apify usage are separate. Workspace owners manage subscription and billing."],
    ["crm-integrations", 13, "CRM integrations", "Connect supported CRMs and review synchronization boundaries.", "crm_integrations", "/app/crm-integrations", "Review supported objects, mappings and conflict behavior before synchronizing records."],
  ].map(([id, number, title, description, feature, path, body]) => ({
    id: id as string,
    number: number as number,
    title: title as string,
    description: description as string,
    duration: "2 min",
    feature: feature as string | undefined,
    roles: id === "billing" || id === "mcp" ? ["owner", "admin"] : undefined,
    steps: [{ id: "overview", title: title as string, body: body as string, path: path as string, target: "workspace-content" }],
  })),
];

export function findTutorialChapter(id?: string) {
  return tutorialChapters.find((chapter) => chapter.id === id);
}
