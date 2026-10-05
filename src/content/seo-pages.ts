export type SeoPageContent = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  image: string;
  imageAlt: string;
  benefits: Array<{ title: string; text: string }>;
  steps: Array<{ title: string; text: string }>;
  useCases: string[];
  faq: Array<[string, string]>;
  related: string[];
};

export const seoPages: Record<string, SeoPageContent> = {
  "web-scraping": {
    path: "/web-scraping",
    eyebrow: "WEB SCRAPING WORKSPACE",
    title: "Web Scraping for Sales Teams | Bizcraw",
    description: "Collect fresh public business data, review every result and turn approved records into connected sales opportunities with Bizcraw.",
    intro: "Bizcraw brings source discovery, scraping runs, result review and CRM execution into one workspace. Your team can collect useful public business data without losing track of source, run status or cost.",
    image: "/landing/bizcraw-source-library-hero.png",
    imageAlt: "Bizcraw web scraping source library with supported data actors",
    benefits: [
      { title: "Choose the right source", text: "Browse supported scraping actors for business locations, search results, jobs and public profiles." },
      { title: "Review before import", text: "Inspect collected records and select the companies or contacts that belong in your CRM." },
      { title: "Keep source context", text: "Preserve the run and source behind imported records so teams can understand where data came from." },
    ],
    steps: [
      { title: "Select a source", text: "Choose a supported actor and review its inputs, events and estimated usage." },
      { title: "Configure the run", text: "Enter the search criteria, URLs, locations or filters required by that source." },
      { title: "Collect and review", text: "Monitor progress, inspect structured results and approve the records you need." },
      { title: "Move into sales", text: "Create CRM records, lists and follow-up work from approved data." },
    ],
    useCases: ["Build prospect lists from public market signals", "Research businesses by location or category", "Collect public profiles and job-market signals", "Move reviewed data into connected CRM workflows"],
    faq: [
      ["What can I scrape with Bizcraw?", "Available sources can include public business locations, search results, jobs and public profiles. The current source library shows the supported inputs and usage model before a run."],
      ["Does Bizcraw scrape data directly?", "Bizcraw orchestrates supported data actors and keeps their runs, results and costs connected to your workspace."],
      ["Can I review data before it enters the CRM?", "Yes. Scrape results remain in their run so users can inspect and select records before importing them."],
    ],
    related: ["web-scraping-for-lead-generation", "scrape-business-leads", "features/scraping"],
  },
  "web-scraping-for-lead-generation": {
    path: "/web-scraping-for-lead-generation",
    eyebrow: "LEAD GENERATION",
    title: "Web Scraping for Lead Generation | Bizcraw",
    description: "Build targeted prospect lists from fresh public data, review the results and turn approved records into leads, contacts and deals.",
    intro: "Web scraping for lead generation works best when collection and sales execution stay connected. Bizcraw helps teams move from a defined market signal to a reviewed prospect record and a clear next action.",
    image: "/landing/bizcraw-scrape-runs.png",
    imageAlt: "Bizcraw scrape run history with collected records and usage",
    benefits: [
      { title: "Start from intent", text: "Define the market, location, category or public signal that makes a prospect relevant." },
      { title: "Reduce manual research", text: "Collect structured records in repeatable runs instead of copying information between tabs." },
      { title: "Create the next action", text: "Turn approved prospects into contacts, companies, deals, tasks and sales lists." },
    ],
    steps: [
      { title: "Define the ideal prospect", text: "Choose the geography, industry, role or public signal that matters to your campaign." },
      { title: "Run a supported scraper", text: "Use the appropriate actor and keep its configuration attached to the run." },
      { title: "Qualify the results", text: "Review duplicates, relevance and available contact or company details." },
      { title: "Assign follow-up", text: "Import approved data and create ownership, stages or tasks inside the workspace." },
    ],
    useCases: ["Territory prospecting", "Account-list building", "Event and campaign research", "Hiring-signal and market research"],
    faq: [
      ["Is scraping the same as buying a lead list?", "No. A scraping workflow starts from defined public sources and criteria, while a purchased list is a fixed dataset created by another party."],
      ["How are duplicate leads handled?", "Users review results before import and can use existing company and contact records as context when selecting data."],
      ["Can the results become deals?", "Approved records can support connected company, contact, lead, deal and task workflows inside Bizcraw."],
    ],
    related: ["web-scraping", "scrape-business-leads", "data-to-crm"],
  },
  "scrape-business-leads": {
    path: "/scrape-business-leads",
    eyebrow: "PROSPECT LIST BUILDING",
    title: "Scrape Business Leads into a Sales Workspace | Bizcraw",
    description: "Find public business records, review useful prospects and organize them as companies, contacts, lists and sales opportunities.",
    intro: "Bizcraw helps sales teams collect business leads from supported public sources and keep the useful records in a workspace designed for follow-up, qualification and pipeline management.",
    image: "/landing/bizcraw-crm-companies.png",
    imageAlt: "Bizcraw company records created from reviewed lead data",
    benefits: [
      { title: "Target a real market", text: "Start with a category, place, search result or profile signal rather than an undifferentiated database." },
      { title: "Keep lists organized", text: "Group approved records for campaigns, territories and research projects." },
      { title: "Continue in one workspace", text: "Connect prospects to companies, contacts, tasks and deals without rebuilding context." },
    ],
    steps: [
      { title: "Choose a business source", text: "Select the source whose public data matches your prospect definition." },
      { title: "Collect structured records", text: "Run the actor with the relevant market, location or keyword inputs." },
      { title: "Select qualified records", text: "Review the result set and keep only useful companies or people." },
      { title: "Build the sales list", text: "Import approved records, organize them and assign the next action." },
    ],
    useCases: ["Local business prospecting", "Industry account lists", "Partner and supplier discovery", "Sales territory research"],
    faq: [
      ["Can I create a list from one scrape run?", "Yes. Results remain associated with the run so selected records can be organized into a focused list."],
      ["Can I add existing customer data too?", "Bizcraw supports structured imports alongside data collected from supported sources."],
      ["Does Bizcraw provide contact details for every company?", "Available fields depend on the selected source and the public data returned by that actor. Bizcraw does not promise that every record contains every field."],
    ],
    related: ["web-scraping-for-lead-generation", "features/data-library", "data-to-crm"],
  },
  "google-maps-lead-scraper": {
    path: "/google-maps-lead-scraper",
    eyebrow: "LOCAL BUSINESS DATA",
    title: "Google Maps Lead Scraper Workflow | Bizcraw",
    description: "Collect public Google Maps business records through supported actors, review results and move qualified companies into your sales workflow.",
    intro: "Use supported Google Maps data actors to research public business listings by location, category or query. Bizcraw keeps the run, result set and selected CRM records connected.",
    image: "/landing/bizcraw-source-library-hero.png",
    imageAlt: "Google Maps scraping actors available in the Bizcraw source library",
    benefits: [
      { title: "Search by market", text: "Configure queries around relevant locations and business categories." },
      { title: "Understand run cost", text: "Review actor pricing information and track usage with each run." },
      { title: "Qualify before outreach", text: "Inspect returned business fields and import only the records relevant to your team." },
    ],
    steps: [
      { title: "Open the source library", text: "Choose an installed Google Maps actor that matches the fields and input you need." },
      { title: "Set location and category", text: "Provide supported queries, locations, URLs or filters." },
      { title: "Review place records", text: "Monitor the run and inspect the structured business results." },
      { title: "Import selected companies", text: "Move approved businesses into the workspace for ownership and follow-up." },
    ],
    useCases: ["Local agency prospecting", "Multi-location market research", "Supplier discovery", "Territory planning"],
    faq: [
      ["Is Google Maps scraping built into Bizcraw?", "Bizcraw connects to supported actors in its source library and orchestrates the run and result workflow."],
      ["What fields are returned?", "Fields vary by actor and configuration. Review each source description and input schema before running it."],
      ["How is pricing calculated?", "Final usage depends on the actor, events and options selected. Bizcraw displays the available cost information around the run."],
    ],
    related: ["features/scraping", "scrape-business-leads", "integrations/apify"],
  },
  "data-to-crm": {
    path: "/data-to-crm",
    eyebrow: "SCRAPED DATA TO CRM",
    title: "Turn Scraped Data into CRM Records | Bizcraw",
    description: "Review scraped data and convert approved results into connected companies, contacts, leads, lists and sales opportunities.",
    intro: "Collected data becomes useful when a team can verify it, organize it and act on it. Bizcraw keeps source results beside the CRM workflows that continue the sales process.",
    image: "/landing/bizcraw-crm-companies.png",
    imageAlt: "Bizcraw CRM companies connected to collected lead data",
    benefits: [
      { title: "Review the source record", text: "Keep the original run and result available while deciding what belongs in the CRM." },
      { title: "Create connected objects", text: "Organize companies, contacts, leads, deals and tasks around the same prospect context." },
      { title: "Preserve accountability", text: "Assign owners and next steps after data is approved." },
    ],
    steps: [
      { title: "Collect", text: "Run a supported source or import structured customer data." },
      { title: "Review", text: "Check relevance, available fields and duplicate context." },
      { title: "Map", text: "Select how the approved record should become a company, contact or lead." },
      { title: "Act", text: "Add lists, tasks, deals and follow-up from the connected record." },
    ],
    useCases: ["Scrape-to-CRM workflows", "List imports", "Account qualification", "Sales handoff and ownership"],
    faq: [
      ["Does every scraped record enter the CRM automatically?", "No. Bizcraw is designed so users can review and choose useful records before importing them."],
      ["Can records connect to deals and tasks?", "Yes. CRM records can provide context for deals, tasks and other supported sales workflows."],
      ["Can Bizcraw synchronize with another CRM?", "CRM connections are managed by provider and workspace. Availability and supported objects are shown in the product."],
    ],
    related: ["web-scraping", "features/data-library", "features/ai-sales-agent"],
  },
  "features/scraping": {
    path: "/features/scraping",
    eyebrow: "SCRAPING FEATURES",
    title: "Managed Web Scraping Runs | Bizcraw",
    description: "Configure supported scraping actors, monitor runs, review records and track usage from a workspace built for sales teams.",
    intro: "Bizcraw turns individual scraping jobs into a repeatable operating workflow. Each run keeps its configuration, status, records and usage visible to the workspace.",
    image: "/landing/bizcraw-scrape-runs.png",
    imageAlt: "Bizcraw scraping job history with status and record counts",
    benefits: [
      { title: "Reusable configuration", text: "Start new runs from supported actor inputs and repeat useful research workflows." },
      { title: "Visible progress", text: "See processing status, collected records and run history in one place." },
      { title: "Controlled import", text: "Keep raw results separate until a user approves them for CRM use." },
    ],
    steps: [
      { title: "Install a source", text: "Connect an available actor to the workspace." },
      { title: "Enter supported inputs", text: "Configure the fields exposed by that actor." },
      { title: "Track the run", text: "Monitor status, records and usage while processing continues." },
      { title: "Review results", text: "Search, select and import the data your team needs." },
    ],
    useCases: ["Recurring market research", "Prospect-list building", "Source cost monitoring", "Team review before CRM import"],
    faq: [
      ["Can I rerun a previous scrape?", "Run history and saved context help teams repeat supported collection workflows."],
      ["Where are results stored?", "Results stay associated with the run and workspace so they can be reviewed before CRM import."],
      ["Can teammates use the same source?", "Installed sources belong to the workspace, subject to plan permissions and workspace roles."],
    ],
    related: ["web-scraping", "features/data-library", "integrations/apify"],
  },
  "features/data-library": {
    path: "/features/data-library",
    eyebrow: "DATA LIBRARY",
    title: "Review and Organize Scraped Data | Bizcraw",
    description: "Keep collected records organized by run and source, then review and select useful data before it enters your CRM.",
    intro: "The data library separates collected results from approved customer records. Teams can inspect what a source returned, preserve provenance and decide what should move forward.",
    image: "/landing/bizcraw-source-library.png",
    imageAlt: "Bizcraw source library and structured scraping records",
    benefits: [
      { title: "Run-level context", text: "Understand which actor and configuration produced each result set." },
      { title: "Structured review", text: "Inspect relevant fields before choosing records for the sales workspace." },
      { title: "Cleaner CRM", text: "Reduce unnecessary imports by keeping raw results outside customer records until approved." },
    ],
    steps: [
      { title: "Open a completed run", text: "Access the result set from the scrape history." },
      { title: "Inspect records", text: "Review the fields returned by the selected actor." },
      { title: "Select useful data", text: "Choose records that match the team’s qualification criteria." },
      { title: "Import with context", text: "Create or connect workspace records while preserving their source." },
    ],
    useCases: ["Result QA", "Source comparison", "Selective CRM import", "Research archives"],
    faq: [
      ["Why keep a data library separate from the CRM?", "Raw collection and customer operations have different purposes. Separating them lets users review data before it affects active records."],
      ["Does the library preserve the source?", "Results remain connected to their run and selected source."],
      ["Can I search collected records?", "Available result views support reviewing the records returned by each run."],
    ],
    related: ["features/scraping", "data-to-crm", "scrape-business-leads"],
  },
  "features/ai-sales-agent": {
    path: "/features/ai-sales-agent",
    eyebrow: "AI SALES AGENT",
    title: "AI Agent for Connected Sales Work | Bizcraw",
    description: "Ask questions about workspace data and prepare supported actions across contacts, deals, tasks, quotes and sales workflows.",
    intro: "The Bizcraw AI agent works with the context already available inside a workspace. It can answer supported questions, prepare changes and keep users in control of high-impact actions.",
    image: "/landing/bizcraw-crm-companies.png",
    imageAlt: "Bizcraw connected sales workspace used by the AI agent",
    benefits: [
      { title: "Workspace-aware answers", text: "Ask about connected companies, contacts, deals, tasks and documents." },
      { title: "Action preparation", text: "Prepare supported records and workflow actions from a natural-language request." },
      { title: "Review boundaries", text: "Sensitive or high-impact changes can require confirmation before execution." },
    ],
    steps: [
      { title: "Ask in plain language", text: "Describe the information or workspace action you need." },
      { title: "Resolve workspace context", text: "The agent uses accessible records and the current user’s permissions." },
      { title: "Review the response", text: "Inspect the answer, sources or proposed changes." },
      { title: "Apply supported actions", text: "Confirm changes that require user review." },
    ],
    useCases: ["Deal and quote status questions", "Task preparation", "Contact and company creation", "Meeting and account summaries"],
    faq: [
      ["Can the agent read every workspace?", "No. Access follows the current workspace, role and module permissions."],
      ["Can the agent change data automatically?", "Supported low-risk actions may be executed directly, while sensitive or high-impact changes can require review."],
      ["Which AI provider does it use?", "Workspaces can configure supported AI providers, and platform AI may be available according to the active plan."],
    ],
    related: ["data-to-crm", "web-scraping-for-lead-generation", "pricing"],
  },
  "integrations/apify": {
    path: "/integrations/apify",
    eyebrow: "APIFY INTEGRATION",
    title: "Apify Scraping Workflows for Sales | Bizcraw",
    description: "Connect an Apify API token, browse supported actors and manage scraping runs and selected results inside Bizcraw.",
    intro: "Bizcraw connects Apify actor capabilities to a sales workspace. Users bring an API token, install supported sources and keep run results beside the CRM processes that use them.",
    image: "/landing/bizcraw-source-library-hero.png",
    imageAlt: "Apify actors displayed in the Bizcraw source library",
    benefits: [
      { title: "Bring your Apify account", text: "Connect a workspace using an Apify API token and keep credential handling server-side." },
      { title: "Discover supported actors", text: "Browse actor descriptions, pricing events and input requirements from the source library." },
      { title: "Connect results to sales", text: "Review run output and move selected records into Bizcraw workflows." },
    ],
    steps: [
      { title: "Create or open Apify", text: "Use an existing Apify account or register a new account." },
      { title: "Generate an API token", text: "Copy a personal API token from the Apify console." },
      { title: "Connect the workspace", text: "Paste and verify the token in Bizcraw settings." },
      { title: "Install and run actors", text: "Choose supported sources and configure their inputs." },
    ],
    useCases: ["Google Maps business research", "Search result collection", "Public profile research", "Jobs and market-signal monitoring"],
    faq: [
      ["Do I need an Apify account?", "Yes. The current integration uses an Apify API token linked to an Apify account."],
      ["Does Bizcraw store the API token?", "Connected credentials are handled server-side and stored using the system’s protected credential workflow."],
      ["Who pays actor usage?", "Actor usage is associated with the connected Apify account and depends on the source and run configuration."],
    ],
    related: ["features/scraping", "google-maps-lead-scraper", "web-scraping"],
  },
  "guides/how-to-build-a-prospect-list-with-web-scraping": {
    path: "/guides/how-to-build-a-prospect-list-with-web-scraping",
    eyebrow: "PRACTICAL GUIDE",
    title: "How to Build a Prospect List with Web Scraping | Bizcraw",
    description: "A practical workflow for defining a market, collecting public business data, reviewing results and creating a useful sales prospect list.",
    intro: "A useful prospect list starts with a clear market definition and ends with an assigned next action. Collection is only the middle of the workflow.",
    image: "/landing/bizcraw-scrape-runs.png",
    imageAlt: "A Bizcraw scraping run used to build a prospect list",
    benefits: [
      { title: "Define before collecting", text: "Write down the geography, industry, company type and signal that makes a record useful." },
      { title: "Collect the minimum useful fields", text: "Choose a source that returns the fields needed for qualification rather than collecting everything." },
      { title: "Design the follow-up", text: "Decide who owns approved records and what action should happen next." },
    ],
    steps: [
      { title: "Define the ideal record", text: "Specify the company, location, role or signal required for the campaign." },
      { title: "Choose a public source", text: "Match the search intent to a supported data actor." },
      { title: "Run a small sample", text: "Validate field quality and relevance before scaling the collection." },
      { title: "Review and activate", text: "Remove irrelevant records, import approved data and assign ownership." },
    ],
    useCases: ["Outbound account lists", "New territory validation", "Partner research", "Vertical-market campaigns"],
    faq: [
      ["How large should the first scrape be?", "Start with a sample large enough to evaluate relevance and fields before committing to a broader run."],
      ["Which fields should I collect?", "Collect the minimum fields needed to identify, qualify and follow up with a prospect."],
      ["What happens after import?", "Assign an owner, list, status or task so approved data enters a defined sales process."],
    ],
    related: ["web-scraping-for-lead-generation", "scrape-business-leads", "features/data-library"],
  },
  "guides/web-scraping-vs-data-enrichment": {
    path: "/guides/web-scraping-vs-data-enrichment",
    eyebrow: "COMPARISON GUIDE",
    title: "Web Scraping vs Data Enrichment for Sales Teams | Bizcraw",
    description: "Understand when to collect new public records with web scraping and when to add fields to customer records with data enrichment.",
    intro: "Web scraping and data enrichment solve different data problems. Scraping discovers or collects records from defined public sources; enrichment adds or validates fields on records you already have.",
    image: "/landing/bizcraw-crm-companies.png",
    imageAlt: "Structured CRM company records inside Bizcraw",
    benefits: [
      { title: "Use scraping for discovery", text: "Collect records when your team needs to identify a market, company set or public signal." },
      { title: "Use enrichment for completeness", text: "Add or verify fields when the company or contact is already known." },
      { title: "Combine them with review", text: "Collect prospects, qualify the useful records and enrich only when more detail is required." },
    ],
    steps: [
      { title: "Start from the business question", text: "Decide whether you need new records or better data about known records." },
      { title: "Choose the correct source", text: "Use collection sources for discovery and enrichment sources for missing fields." },
      { title: "Check provenance", text: "Keep the source and time of collection visible." },
      { title: "Apply CRM rules", text: "Review duplicates and map approved fields into the correct records." },
    ],
    useCases: ["Market discovery with scraping", "Contact completion with enrichment", "CRM cleanup", "Source-aware prospect research"],
    faq: [
      ["Is scraping a replacement for enrichment?", "No. Scraping can discover records, while enrichment typically starts with an existing record and adds information."],
      ["Should enrichment happen before CRM import?", "It depends on the qualification workflow. Some teams qualify the source record first and enrich only approved prospects."],
      ["Why preserve provenance?", "Source context helps users understand when and where a field was collected and whether it should be refreshed."],
    ],
    related: ["web-scraping", "data-to-crm", "features/data-library"],
  },
};

export const seoPageList = Object.values(seoPages);
