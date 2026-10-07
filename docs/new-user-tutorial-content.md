# Bizcraw New User Tutorial — Content Specification

Status: implemented content specification. The live tutorial uses this structure and can be refined as product workflows change.

## Product concept

The tutorial appears as a book launcher beside the AI Agent launcher. It is a persistent, resumable guide rather than a one-time modal tour.

The experience has two layers:

1. **First-run journey** — the shortest path from a new workspace to a completed scrape and reviewed result.
2. **Guidebook chapters** — task-based help for CRM, sales, collaboration, integrations and account management.

Every step can contain:

- A short title and one clear instruction.
- A primary action that navigates to the correct page.
- A spotlight target identified by a stable tutorial ID.
- A completion condition based on real workspace state.
- An optional “Ask AI” action that opens the Agent with the current chapter and step context.
- Back, Next, Skip and Exit controls.

The tutorial must adapt to role, plan permissions and current workspace state. It must never send a member to an owner-only control or highlight a module their plan does not include.

## Entry experience

### Launcher

Label: **Guidebook**

Tooltip: **Learn Bizcraw step by step**

Placement: beside the AI Agent widget in the bottom-right corner.

Unread state: show a small dot until the user chooses a goal or dismisses the welcome chapter.

### Welcome panel

**Title**

Welcome to Bizcraw

**Body**

Choose what you want to accomplish. Bizcraw will take you to the right place and guide you through each step.

**Goal cards**

1. **Find new leads**  
   Connect Apify, choose a data source and run your first scrape.

2. **Organize my CRM**  
   Learn how leads, companies, contacts, deals and tasks work together.

3. **Set up my workspace**  
   Configure workspace settings, AI, teammates and billing.

4. **Create a quote**  
   Build a quote from a deal or start a new quote manually.

5. **Explore on my own**  
   Open the full guidebook and choose any chapter.

**Footer note**

You can exit at any time. Your progress will be saved for this workspace.

## First-run journey

### Chapter 1 — Meet your workspace

Chapter description: Learn where to find data sources, scraping runs and customer records.

#### Step 1.1 — Dashboard

- Route: `/app`
- Spotlight: dashboard overview
- Title: **Your workspace at a glance**
- Body: **The dashboard summarizes your sales activity, pipeline, tasks and recent records. It becomes more useful as your team adds data and works opportunities.**
- Primary action: **Show me the sidebar**
- Completion: user continues.

#### Step 1.2 — Find

- Route: current route
- Spotlight: sidebar group `Find`
- Title: **Find new market data**
- Body: **Sources is where you choose scraping tools. Scrape is where you start runs, monitor progress and review run history.**
- Completion: user continues.

#### Step 1.3 — CRM

- Spotlight: sidebar group `CRM`
- Title: **Turn useful data into sales records**
- Body: **Leads are prospects to qualify. Companies and contacts hold customer context. Deals and tasks help your team move opportunities forward.**
- Completion: user continues.

#### Step 1.4 — Sales and workspace tools

- Spotlight: available `Sell`, `Engage` and `Workspace` groups
- Title: **Continue the workflow**
- Body: **Your plan may also include quotes, product modules, contracts, inbox, calendar, sequences, CRM integrations and MCP access. The guidebook only shows chapters available to your role and plan.**
- Completion: chapter complete.

### Chapter 2 — Connect Apify

Chapter description: Connect the account Bizcraw uses to run Actors and retrieve results.

Prerequisite logic:

- If the workspace already has an active Apify connection, mark Steps 2.1–2.6 complete and offer **Review connection**.
- Only workspace owners and admins can perform connection steps.
- Members see: **Ask a workspace owner or admin to connect Apify before running a source.**

#### Step 2.1 — Why Apify is required

- Route: `/app/settings`
- Spotlight: Apify settings section
- Title: **Connect the scraping engine**
- Body: **Bizcraw uses Apify Actors to collect public web data. Your Apify account owns the Actor runs, usage and generated datasets.**
- Primary action: **Set up Apify**

#### Step 2.2 — Create or sign in to Apify

- External URL: `https://console.apify.com/sign-up`
- Title: **Create your Apify account**
- Body: **Open Apify and create an account with email, Google or GitHub. If you already have an account, sign in instead.**
- Primary action: **Open Apify sign-up**
- Secondary action: **I already have an account**
- Note: **Email sign-up may require email verification before you can continue.**

#### Step 2.3 — Open API & Integrations

- External URL: `https://console.apify.com/account#/integrations`
- Title: **Open API & Integrations**
- Body: **In Apify Console, open Settings → API & Integrations. This is where Apify manages API tokens and connected services.**
- Primary action: **Open API & Integrations**

#### Step 2.4 — Create a dedicated token

- Title: **Create a token for Bizcraw**
- Body: **Create a separate token named “Bizcraw”. A dedicated token is easier to revoke or rotate without affecting your other integrations.**
- Checklist:
  - Allow Actor runs.
  - Allow access to the datasets and storage created by those runs.
  - Use only the permissions needed for this integration.
- Security note: **Treat the token like a password. Never paste it into AI chat, email or a support message.**

#### Step 2.5 — Paste the token in Bizcraw

- Route: `/app/settings`
- Spotlight: Apify token field
- Title: **Connect the account**
- Body: **Paste the token into the Apify connection field, keep the connection name as “Bizcraw”, then select Verify and connect.**
- Primary action: **Highlight token field**
- Completion: workspace Apify connection becomes active.

#### Step 2.6 — Confirm the connection

- Spotlight: connected Apify account card
- Title: **Apify is connected**
- Body: **Bizcraw can now run Actors and retrieve their results. Check the account name, plan and usage shown here before continuing.**
- Primary action: **Choose a source**
- Destination: `/app/leads/sources`
- Completion: active connection detected.

Source notes for internal review:

- Apify documents API tokens under Settings → API & Integrations.
- Apify recommends a separate token per service and supports scoped permissions, expiration and rotation.
- Bizcraw should link to Apify documentation rather than reproduce volatile permission-screen labels.

### Chapter 3 — Choose and install a source

Chapter description: Find an Actor whose output matches the data you need.

#### Step 3.1 — Open Sources

- Route: `/app/leads/sources`
- Spotlight: Sources navigation item
- Title: **Browse available sources**
- Body: **Each source is an Apify Actor with its own input fields, output structure and pricing. Start from the data you need, not only the website name.**

#### Step 3.2 — Search and filter

- Spotlight: source search and filters
- Title: **Find the right Actor**
- Body: **Search by platform or outcome, then narrow the catalog by category. Examples include local businesses, company profiles, jobs, products, reviews and social content.**
- Example searches: `Google Maps`, `LinkedIn jobs`, `Instagram profiles`, `company contacts`

#### Step 3.3 — Check the source before installing

- Spotlight: selected source card and pricing details
- Title: **Review coverage and cost**
- Body: **Check what the Actor collects, its input requirements and its pricing events. Returned fields and final Apify cost depend on the Actor and selected options.**
- Warning: **Bizcraw does not guarantee that every source returns an email, phone number or any other specific field.**

#### Step 3.4 — Install the source

- Spotlight: Install action
- Title: **Add this source to your workspace**
- Body: **Install the Actor so your team can use it from the Scrape page. You can remove it later without deleting completed run history.**
- Completion: at least one source installed.
- Primary action: **Start a scrape**
- Destination: `/app/leads/scrape/new`

### Chapter 4 — Run your first scrape

Chapter description: Configure one Actor safely and understand what happens before it starts.

#### Step 4.1 — Select an installed source

- Route: `/app/leads/scrape/new`
- Spotlight: installed source selector
- Title: **Choose what will run**
- Body: **Select an installed source. The form below changes because every Actor accepts different inputs.**

#### Step 4.2 — Read the quick guide

- Spotlight: Actor quick guide
- Title: **Understand the required inputs**
- Body: **Start with the short guide: what this Actor collects, what you must provide and one working example. Open field help only when you need more detail.**
- AI action: **Ask AI to explain this Actor**
- AI prompt: `Explain how to use this Actor. Tell me what is required, give me a safe first-run example and warn me about options that may increase cost.`

#### Step 4.3 — Complete required fields

- Spotlight: first incomplete required field
- Title: **Enter the minimum valid input**
- Body: **Required fields are marked. Use the provided example as a format guide, then replace it with your own target. Leave optional fields unchanged for your first run unless you understand their effect.**
- Completion: client-side schema validation passes.

#### Step 4.4 — Review scope and cost

- Spotlight: pricing and run summary
- Title: **Start small**
- Body: **Use a small result limit for your first run. Review the Actor pricing model and any paid add-ons before spending Apify usage.**
- Warning: **Actor pricing is controlled by Apify and may change.**

#### Step 4.5 — Start the run

- Spotlight: Start run button
- Title: **Run the Actor**
- Body: **Starting the run sends your inputs to Apify. You can leave this page and follow progress from Scrape.**
- Completion: scrape job created.
- Primary action: **View run progress**

### Chapter 5 — Monitor and review results

#### Step 5.1 — Run history

- Route: `/app/leads/scrape`
- Spotlight: run history table
- Title: **Every run stays traceable**
- Body: **Run history shows the Actor, who started it, status, records received, Apify cost and creation time. Use filters to find earlier work.**

#### Step 5.2 — Running jobs

- Spotlight: current running row
- Title: **Monitor or cancel a run**
- Body: **Open a running job to check progress. If it is stuck, incorrect or no longer needed, cancel it so the workspace can start another run.**
- Completion: run reaches a terminal status or user continues.

#### Step 5.3 — Review the dataset

- Route pattern: `/app/leads/scrape/{jobId}`
- Spotlight: dataset explorer
- Title: **Inspect the returned records**
- Body: **Search, sort and inspect the fields returned by this Actor. Open a record to review nested data before selecting anything for CRM import.**

#### Step 5.4 — Select useful records

- Spotlight: result selection controls
- Title: **Keep only relevant data**
- Body: **Select records that match your target market and data-quality rules. Scraped results remain attached to this run even when you do not import them.**

#### Step 5.5 — Import to CRM

- Spotlight: import controls
- Title: **Create sales records from approved results**
- Body: **Import selected records into the workspace. Bizcraw creates or connects the supported company, contact and lead records while preserving their source context.**
- Completion: at least one record imported.
- Primary action: **Open Leads**
- Destination: `/app/leads`

### Chapter 6 — Work a lead

This chapter uses a two-level pattern: the first step opens the first available record automatically; subsequent steps continue inside that detail route. If the list is empty, the tutorial highlights the list and explains that a record must be created first.

- **Lead detail:** maintain company, contact, source and status; convert a qualified lead into a deal; record activity.
- **Company detail:** maintain the account profile; record account activity; review connected contacts and deals; maintain the account plan.
- **Contact detail:** maintain identity, role, channels, company and relationship strength; preserve interaction history.
- **Deal detail:** read stage, probability, weighted value, close date and stakeholder coverage; maintain timeline; define the next step; connect quotes and contracts; map the buying group; review core details.
- **Tasks:** give each opportunity a concrete owner and due date.

## Guidebook chapters

These chapters are available from the book index and are not required to finish the first-run journey.

### Chapter 7 — Quotes

- Purpose: create, edit and manage quotes manually or from a deal.
- Guided areas:
  - **Brief & client:** choose customer and project context or generate a reviewed AI brief.
  - **Catalog:** choose approved modules and verify line items, quantities and prices.
  - **Commercial:** set validity, contract reference, timeline, next steps, warranty and maintenance.
  - **Preview:** review the final proposal, totals and recipient before delivery.
- Suggested AI question: **Help me prepare a quote for this deal.**

### Chapter 8 — Modules & knowledge

- **Catalog:** maintain reusable products and services used in quotes.
- **Knowledge Files:** upload approved source documents that Bizcraw indexes for retrieval-augmented generation (RAG). AI uses retrieved passages as evidence when producing module and quote suggestions.
- **Needs review:** approve accurate module drafts extracted from knowledge files and reject duplicates or unsupported content.
- Suggested AI question: **Explain how Knowledge Files and RAG improve quote suggestions.**

### Chapter 9 — Contracts

- Purpose: track contract records connected to commercial work.
- Key guidance:
  - Create a contract with a title, related deal and optional quote and DOCX.
  - Use the list to track draft, sent, signed and void agreements.
  - Open the edit action to maintain status, notes and contract files or generate a document from a connected quote.
- Suggested AI question: **Show me how contracts relate to deals and quotes.**

### Chapter 10 — Inbox, calendar and sequences

- Purpose: understand the available engagement tools.
- Key guidance:
  - Inbox currently records supported communications and integration activity.
  - Calendar manages stored meetings; external calendar synchronization depends on available integrations.
  - Sequences define repeatable follow-up steps and enrollments when the module is enabled.
- Suggested AI question: **Which engagement tools are available in my plan?**

### Chapter 11 — Team and workspace settings

- Purpose: configure ownership, workspace identity and access.
- Key guidance:
  - Owners and admins can invite members where supported.
  - Settings contains workspace details, language, Apify and AI configuration.
  - Do not paste API keys into AI chat; use the dedicated secure fields.
- Suggested AI question: **Check what is still missing from my workspace setup.**

### Chapter 12 — Billing and plan access

- Purpose: understand plan, seats, modules and usage limits.
- Key guidance:
  - The owner controls subscription and billing.
  - A plan can limit seats, modules, quotes and AI actions.
  - Apify usage is separate from the Bizcraw subscription and belongs to the connected Apify account.
- Suggested AI question: **Explain my current plan and available features.**

### Chapter 13 — CRM integrations

- Purpose: connect supported external CRMs and understand synchronization boundaries.
- Key guidance:
  - Review supported objects and field mappings before synchronization.
  - Confirm conflict behavior and ownership before importing or updating records.
  - Check synchronization history when records do not appear as expected.
- Suggested AI question: **Help me understand this CRM connection and its latest sync.**

### Chapter 14 — MCP access

- Purpose: connect an approved AI client to scoped Bizcraw tools and verify the connection safely.
- Availability: workspace owners and admins when the `mcp_access` feature is enabled.
- Steps:
  1. **Understand the MCP workspace:** explain scopes, plan access and workspace isolation.
  2. **Connect ChatGPT with OAuth:** open ChatGPT connector settings, use the Bizcraw server URL, sign in and review the requested scopes. No token copying is required.
  3. **Use the production server URL:** enter `https://bizcraw.com/api/mcp` and allow the client to discover Bizcraw OAuth.
  4. **Connect a token-based client:** for Claude, Cursor, Codex or another compatible client, create a named connection with the minimum scopes and a practical expiry. Copy the token once.
  5. **Verify the connection:** ask **What Bizcraw workspace am I connected to?** and confirm `get_workspace`, Last used and Recent calls.
  6. **Approve sensitive actions:** review paid or externally meaningful requests before approving or rejecting them.
  7. **Review and revoke access:** inspect tool-call history, rotate moved tokens and revoke clients that are no longer trusted.
- Security guidance:
  - Prefer OAuth when the client supports it.
  - Never paste a token into an AI conversation.
  - Give each client only the scopes it needs.
- Suggested AI question: **Guide me through connecting this AI client to Bizcraw with the safest available method.**

### Chapter 15 — AI Agent

- Purpose: explain what the Agent can read, suggest and change.
- Key guidance:
  - The tutorial opens the Agent Widget automatically and keeps it visible while the coachmark explains each area.
  - Starter questions remain visible in tutorial mode even when the user already has conversation history.
  - The Agent receives the current page path so it can answer in context.
  - Read actions can summarize accessible workspace data.
  - Write actions must show a reviewable preview and require confirmation where approval is configured.
  - The Agent must distinguish workspace facts from advice and must not invent missing records, Actor fields or integration state.
- Suggested AI question: **What can you help me do on this page?**

## AI Agent first-open questions

When the Agent opens with no conversation, replace the passive empty message with:

**Title**

What would you like to do?

**Suggested prompts**

1. **Guide me through my first scrape**  
   Sends: `Guide me through my first scrape. Check my workspace readiness and start the correct tutorial chapter.`

2. **Help me connect Apify**  
   Sends: `Help me connect Apify safely. Explain each step and open the setup guide.`

3. **Help me choose an Actor**  
   Sends: `Ask what data I need, then help me choose and use the right installed or available Actor.`

4. **Explain this page**  
   Sends: `Explain the current page, what I can do here and the safest next action.`

5. **Check my workspace setup**  
   Sends: `Check whether this workspace is ready to use. List missing setup steps without changing anything.`

6. **Show me how CRM records connect**  
   Sends: `Explain how leads, companies, contacts, deals and tasks connect in Bizcraw.`

The Agent can answer normally or return a structured client action:

- `open_tutorial(chapterId, stepId)`
- `navigate_and_highlight(path, targetId)`
- `resume_tutorial()`

The browser must validate these actions against a static tutorial manifest. The model must never provide arbitrary selectors or arbitrary internal routes.

## Contextual AI questions

Suggested prompts should change with the current page:

| Context | Suggested question |
| --- | --- |
| Dashboard | What should I do next in this workspace? |
| Sources | Help me choose a source for the data I need. |
| New scrape | Explain this Actor and give me a safe first-run example. |
| Run history | Which run needs my attention? |
| Run detail | Help me understand these results before I import them. |
| Leads | Which leads should I review next? |
| Companies | Explain the context we have for this company. |
| Deals | Which deals need a next step? |
| Quotes | Help me prepare or review a quote. |
| Settings | Check whether Apify and AI are configured correctly. |
| Billing | Explain my plan, limits and current access. |

## Highlight and movement language

The animation should feel like a game quest while remaining calm and readable.

### Navigation transition

1. User selects a tutorial step.
2. The book minimizes into a compact progress card.
3. A short directional trail moves from the book toward the target area.
4. The router navigates to the target page.
5. After the target is mounted and visible, the page scrolls it into view.
6. A dimmed backdrop appears while the target receives a soft green spotlight and two pulse rings.
7. The instruction card anchors beside the target without covering it.

### Interaction rules

- Do not simulate clicks on destructive or paid actions.
- A user click can complete a step only when the expected state change succeeds.
- If the target is unavailable because of role or plan, explain why and offer the closest available chapter.
- If the route changes manually, pause the current spotlight and offer **Continue here** or **Return to tutorial**.
- Respect `prefers-reduced-motion`; replace movement with a short fade and static outline.
- Keep the highlighted element interactive unless the step is explanatory only.
- Never trap the user inside the tutorial.

## Progress and completion copy

### Chapter completed

**Title:** Chapter complete

**Body:** You now know how to {chapter outcome}. Continue to the next chapter or return to your work.

### First-run journey completed

**Title:** Your first workflow is ready

**Body:** You connected a data source, reviewed a scrape and learned how approved records move into CRM. Use the guidebook whenever you want help with another workflow.

**Actions:**

- **Explore another chapter**
- **Ask AI what to do next**
- **Close guidebook**

## Content rules

- Use English as the source language.
- Keep each spotlight instruction below 45 words where possible.
- Describe only functionality available in the current product and plan.
- Treat third-party UI labels as volatile. Link to official documentation when exact labels may change.
- Never promise that an Actor returns a specific field unless its current schema guarantees it.
- Separate Bizcraw subscription limits from Apify usage and billing.
- Never ask users to send secrets through AI chat.
- Explain approval before any AI write action.

## Implementation boundary after content approval

The first implementation milestone should include:

1. Guidebook launcher, book index and saved progress.
2. Stable `data-tutorial-id` targets in the app shell, Settings, Sources, Scrape and CRM pages.
3. Navigate, wait-for-target, scroll and spotlight engine.
4. Chapters 1–6 and AI starter questions.
5. Page-aware AI actions that can open only validated tutorial steps.
6. Role, plan, completion-state and reduced-motion handling.

Chapters 7–15 can then reuse the same engine without adding another tutorial framework.
