export type MarketingCard = {
  href: string;
  label: string;
  title: string;
  description: string;
};

export type MarketingHubContent = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  cards: MarketingCard[];
  sectionTitle: string;
  sectionText: string;
};

export const marketingHubs: Record<string, MarketingHubContent> = {
  features: {
    path: "/features",
    eyebrow: "PRODUCT FEATURES",
    title: "A connected workspace from scraping to sales action.",
    description: "Explore Bizcraw features for managed web scraping, structured data review and workspace-aware AI sales operations.",
    intro: "Bizcraw brings data collection, review and sales execution into one workspace. Start with a targeted scrape, keep the useful records and continue the work without rebuilding context.",
    sectionTitle: "Explore the Bizcraw product",
    sectionText: "Each feature is designed around a clear handoff from public data to a reviewable sales workflow.",
    cards: [
      { href: "/features/scraping", label: "SCRAPING", title: "Managed web scraping runs", description: "Configure supported sources, monitor progress and review results before they enter your CRM." },
      { href: "/features/data-library", label: "DATA LIBRARY", title: "Structured data review", description: "Keep collected records organized by source and run while your team checks relevance and quality." },
      { href: "/features/ai-sales-agent", label: "AI SALES AGENT", title: "Workspace-aware assistance", description: "Ask about accessible workspace records and prepare supported sales actions with review boundaries." },
    ],
  },
  solutions: {
    path: "/solutions",
    eyebrow: "SOLUTIONS",
    title: "Turn web data into a repeatable sales workflow.",
    description: "Use Bizcraw to discover business leads, qualify scraped records and move approved data into connected CRM workflows.",
    intro: "Choose the workflow that matches your research goal. Bizcraw keeps the source, result set and next sales action connected from the beginning.",
    sectionTitle: "Start from the outcome you need",
    sectionText: "Use a focused workflow for market discovery, lead generation, Google Maps research or CRM activation.",
    cards: [
      { href: "/lead-scraping-platform", label: "B2B LEAD SCRAPING", title: "Lead scraping platform", description: "Collect public business data, review structured results and move approved leads into connected sales workflows." },
      { href: "/web-scraping", label: "WEB SCRAPING", title: "Web scraping for sales teams", description: "Collect structured public data with supported sources and preserve the context behind each record." },
      { href: "/web-scraping-for-lead-generation", label: "LEAD GENERATION", title: "Build qualified prospect lists", description: "Define a target market, collect relevant records and give every approved prospect a next action." },
      { href: "/google-maps-lead-scraper", label: "LOCAL BUSINESS DATA", title: "Google Maps lead workflow", description: "Research locations and business categories, then review returned companies before CRM import." },
      { href: "/scrape-business-leads", label: "BUSINESS LEADS", title: "Scrape business leads", description: "Turn selected business and contact records into organized sales lists and follow-up work." },
      { href: "/data-to-crm", label: "CRM ACTIVATION", title: "Move scraped data into CRM", description: "Map approved records into companies, contacts, deals and tasks without losing source context." },
    ],
  },
  guides: {
    path: "/guides",
    eyebrow: "RESOURCES",
    title: "Practical guides for responsible sales data workflows.",
    description: "Read Bizcraw guides about web scraping, prospect research, data enrichment and moving reviewed records into sales workflows.",
    intro: "Use these guides to plan the work around collection: define the market, choose the right source, review data quality and decide what should happen after import.",
    sectionTitle: "Learn the workflow",
    sectionText: "Each guide focuses on a practical decision that improves the quality and usefulness of collected data.",
    cards: [
      { href: "/guides/how-to-build-a-prospect-list-with-web-scraping", label: "STEP-BY-STEP GUIDE", title: "Build a prospect list with web scraping", description: "Define an ideal record, validate a sample and move qualified prospects into an owned follow-up process." },
      { href: "/guides/web-scraping-vs-data-enrichment", label: "COMPARISON", title: "Web scraping vs data enrichment", description: "Understand when to discover new records and when to improve information about companies you already know." },
      { href: "/web-scraping-for-lead-generation", label: "WORKFLOW", title: "Web scraping for lead generation", description: "See how collection, qualification and sales activation fit together inside one workspace." },
    ],
  },
  integrations: {
    path: "/integrations",
    eyebrow: "INTEGRATIONS",
    title: "Connect data sources to the workspace that uses them.",
    description: "Explore Bizcraw integrations for scraping providers, CRM data workflows and configurable AI providers.",
    intro: "Bizcraw keeps external services behind workspace permissions and makes their output useful inside a controlled sales process.",
    sectionTitle: "Connected workflows",
    sectionText: "Integrations are presented only when there is a clear setup path and an operational workflow inside Bizcraw.",
    cards: [
      { href: "/integrations/apify", label: "SCRAPING PROVIDER", title: "Apify integration", description: "Connect an Apify API token, browse supported actors and manage run results inside Bizcraw." },
      { href: "/data-to-crm", label: "CRM WORKFLOW", title: "Structured data to CRM", description: "Review collected records and map approved data into connected sales objects." },
      { href: "/features/ai-sales-agent", label: "AI PROVIDERS", title: "Configurable workspace AI", description: "Use supported providers or an OpenAI-compatible endpoint for workspace AI features." },
    ],
  },
};

export type MarketingInfoSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type MarketingInfoContent = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  updated?: string;
  sections: MarketingInfoSection[];
};

export const marketingInfoPages: Record<string, MarketingInfoContent> = {
  whatIsBizcraw: {
    path: "/what-is-bizcraw",
    eyebrow: "WHAT IS BIZCRAW?",
    title: "Bizcraw turns web data into sales work.",
    description: "Learn what Bizcraw is, how its web scraping and AI sales workspace works, and where it fits between data collection and CRM execution.",
    intro: "Bizcraw is a web scraping and AI sales workspace that helps teams collect public business data, review structured results, turn approved records into CRM data and manage the sales work that follows.",
    updated: "October 6, 2026",
    sections: [
      {
        title: "Bizcraw in one sentence",
        paragraphs: [
          "Bizcraw connects web scraping, structured data review, CRM records and AI-assisted sales operations in one workspace.",
          "Instead of ending a scraping job with a disconnected export, teams can keep the source, run history and selected records attached as the data moves into companies, contacts, lists, deals, tasks, quotes and contracts.",
        ],
      },
      {
        title: "What Bizcraw does",
        paragraphs: [
          "Teams start by choosing a supported data source or actor, configuring a targeted run and reviewing the returned records. Useful records can then continue into the workspace without losing where they came from.",
        ],
        bullets: [
          "Browse supported scraping sources and understand their inputs",
          "Run targeted data collection and monitor status and usage",
          "Review structured results before CRM import",
          "Manage connected companies, contacts, deals, tasks, quotes and contracts",
          "Ask the AI agent about accessible workspace data and prepare supported actions",
        ],
      },
      {
        title: "How Bizcraw differs from a standalone scraper",
        paragraphs: [
          "A standalone scraper primarily collects data. Bizcraw adds the review and operational layer around that collection: source discovery, guided actor inputs, result review, CRM activation and the sales workflow after import.",
          "Bizcraw does not hide the underlying source. Runs retain their context so users can assess data quality, control what enters the CRM and understand how a record was discovered.",
        ],
      },
      {
        title: "How Bizcraw fits with a CRM",
        paragraphs: [
          "Bizcraw includes workspace-native records and sales workflows for teams that want a connected path from discovery to execution. It can also connect with external CRM platforms as supported connectors become available.",
          "The goal is to reduce the manual handoff between prospect research, spreadsheets and sales systems while keeping users in control of every imported record.",
        ],
      },
      {
        title: "Who Bizcraw is for",
        paragraphs: [
          "Bizcraw is designed for sales, business development, growth and market-research teams that regularly collect public business information and need a repeatable process for turning it into accountable follow-up.",
        ],
        bullets: [
          "Teams building targeted B2B prospect lists",
          "Sales operations teams reviewing and routing collected data",
          "Agencies managing repeatable research workflows",
          "Small teams that want scraping and CRM execution in one workspace",
        ],
      },
      {
        title: "Control stays with the user",
        paragraphs: [
          "Bizcraw is designed around workspace boundaries, roles, plan permissions and reviewable operations. Scraped records do not need to enter the CRM automatically, and supported high-impact AI actions can require approval before execution.",
          "Users remain responsible for choosing lawful data sources, configuring collection appropriately and using the resulting data in accordance with applicable rules and provider terms.",
        ],
      },
    ],
  },
  about: {
    path: "/about",
    eyebrow: "ABOUT BIZCRAW",
    title: "Sales data is more useful when the next action stays attached.",
    description: "Learn why Bizcraw connects web scraping, structured lead data, CRM records and AI-assisted sales work in one workspace.",
    intro: "Bizcraw is a web scraping and AI sales workspace built for teams that need fresh market data and a controlled way to turn it into real sales work.",
    sections: [
      { title: "Why Bizcraw exists", paragraphs: ["Prospect research often ends in disconnected files. Sales teams then spend more time cleaning, copying and reconstructing context than deciding which opportunity deserves attention.", "Bizcraw connects collection with execution. Every useful record can keep its source and continue into a company, contact, list, deal, task, quote or follow-up workflow."] },
      { title: "Scraping is the starting point", paragraphs: ["The product starts with supported data sources and repeatable scraping runs. Teams can inspect the inputs, monitor processing and review structured results before adding anything to active CRM records."], bullets: ["Source discovery and actor setup", "Run history, status and usage visibility", "Controlled review before CRM import"] },
      { title: "Built for accountable action", paragraphs: ["Workspace roles, module permissions and review gates help keep users in control. AI features work with accessible workspace context and can prepare supported actions without hiding where the answer came from."] },
    ],
  },
  contact: {
    path: "/contact",
    eyebrow: "CONTACT",
    title: "Talk to the Bizcraw team.",
    description: "Contact Bizcraw for product questions, workspace support, partnerships, privacy requests or security reports.",
    intro: "Business email support is being prepared. This page explains what to include once the direct support channel is available; never send passwords, API keys or sensitive customer data.",
    sections: [
      { title: "Product and sales questions", paragraphs: ["Ask about supported scraping workflows, workspace plans, CRM operations or whether Bizcraw fits a specific sales research process."], bullets: ["Use case and target market", "Expected data source", "Team size and workflow"] },
      { title: "Account and technical support", paragraphs: ["When the support channel is available, existing users should include their workspace name, the affected page and the approximate time an issue occurred. Never send account passwords or provider API keys."] },
      { title: "Privacy and security", paragraphs: ["The direct channel for privacy requests and responsible security reports will be published on this page. Describe the affected area and avoid including live customer data in the first message."] },
    ],
  },
  security: {
    path: "/security",
    eyebrow: "SECURITY",
    title: "Workspace boundaries and reviewable operations.",
    description: "Learn how Bizcraw approaches workspace isolation, role-aware access, server-side credentials and reviewable AI actions.",
    intro: "Bizcraw is designed around separated workspaces, explicit access checks and controlled connections to external providers.",
    updated: "October 5, 2026",
    sections: [
      { title: "Workspace isolation", paragraphs: ["Business records are associated with a workspace, and application workflows resolve the active workspace before reading or changing customer data."], bullets: ["Workspace-scoped database access", "Role and membership checks", "Plan and module permission enforcement"] },
      { title: "Credentials and integrations", paragraphs: ["Provider credentials are handled through server-side workflows. Users should never place API keys in notes, prompts, imported files or other general workspace fields."] },
      { title: "AI and sensitive actions", paragraphs: ["AI access follows the current workspace and user permissions. Supported high-impact operations can require an approval step and create operational records for later review."], bullets: ["Permission-aware context", "Approval gates for sensitive operations", "Audit-oriented operational history"] },
      { title: "Report a concern", paragraphs: ["If you believe you found a security issue, contact the Bizcraw team with a clear description, affected URL and reproduction steps. Do not access or alter data that does not belong to you."] },
    ],
  },
  privacy: {
    path: "/privacy",
    eyebrow: "PRIVACY",
    title: "Bizcraw Privacy Notice",
    description: "Read how Bizcraw handles account, workspace, integration and usage information when providing the service.",
    intro: "This notice explains the main categories of information processed by Bizcraw and the choices available to workspace users.",
    updated: "October 5, 2026",
    sections: [
      { title: "Information you provide", paragraphs: ["Bizcraw processes account details, workspace settings, business records, uploaded files and content that users choose to create or import. Connected providers may also return data requested by a workspace user."], bullets: ["Account and workspace profile information", "CRM, scraping and document content", "Integration configuration and provider identifiers", "Support requests and operational logs"] },
      { title: "How information is used", paragraphs: ["Information is used to authenticate users, provide workspace features, run requested integrations, secure the service, diagnose failures and administer plans and usage limits."] },
      { title: "Service providers", paragraphs: ["Bizcraw relies on infrastructure, authentication, email, payment, scraping and AI providers where required by the feature a user chooses. A connected provider may process information under its own terms and account configuration."] },
      { title: "Retention and deletion", paragraphs: ["Information is retained while needed to provide the service, secure operations and meet applicable obligations. Retention periods can vary by data type and feature. The contact page will list the current request channel when it becomes available."], bullets: ["Remove unneeded provider connections", "Avoid uploading unnecessary personal data", "Review the contact page for access, export or deletion request information"] },
      { title: "Updates and contact", paragraphs: ["This notice may change as Bizcraw adds features or providers. Material updates will be reflected by the date on this page. The Bizcraw contact page will publish the current privacy request channel."] },
    ],
  },
  terms: {
    path: "/terms",
    eyebrow: "TERMS",
    title: "Bizcraw Terms of Service",
    description: "Review the terms that apply when creating a Bizcraw account, workspace or connected data workflow.",
    intro: "These terms describe the basic rules for using Bizcraw. By creating an account or using the service, you agree to follow them and all applicable laws.",
    updated: "October 5, 2026",
    sections: [
      { title: "Accounts and workspaces", paragraphs: ["You are responsible for accurate account information, protecting sign-in access and managing members invited to your workspace. Workspace owners control access, roles and connected services."] },
      { title: "Acceptable use", paragraphs: ["Use Bizcraw only for lawful purposes and only with data you are permitted to collect, upload, process or contact."], bullets: ["Do not bypass access controls or technical restrictions", "Do not collect or use data in violation of applicable law or third-party rights", "Do not upload malware, secrets belonging to others or unlawful content", "Do not use the service to send abusive, deceptive or unsolicited communications"] },
      { title: "Scraping and third-party services", paragraphs: ["You are responsible for selecting data sources and configuring collection in accordance with applicable websites, providers and laws. Third-party services such as scraping, CRM, payment and AI providers are also governed by their own terms and availability."] },
      { title: "Plans, usage and availability", paragraphs: ["Plans can control seats, modules and usage limits. Paid features, billing providers and prices are shown before purchase. Features may change as the product develops, and uninterrupted availability is not guaranteed."] },
      { title: "Suspension and termination", paragraphs: ["Access may be limited or suspended to protect users, respond to abuse, enforce plan limits or comply with legal obligations. You may stop using Bizcraw; the contact page will list the current account-assistance channel when it becomes available."] },
      { title: "Updates and contact", paragraphs: ["These terms may be updated as the service changes. The latest version and effective date will remain available on this page. The Bizcraw contact page will publish the current channel for questions."] },
    ],
  },
};

export const marketingIndexPaths = [
  ...Object.values(marketingHubs).map((page) => page.path),
  ...Object.values(marketingInfoPages).map((page) => page.path),
];
