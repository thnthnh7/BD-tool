# Leadely — Master Document

Complete project reference: purpose, tech stack, architecture, product features, SaaS model, billing, platform admin, schema, APIs, environment variables, and operations.

Last reconciled: **2026-09-24 (Asia/Saigon)**, against the local codebase (`bd-tool-app@0.1.0`). This describes implementation, not a claim that every migration, integration, or feature is deployed and production-verified. Catalog counts are a dated database snapshot.

This is the implementation reference. `LEADELY_ARCHITECTURE_V2.md`, `LEADELY_DASHBOARD_CURSOR_SPEC.md`, and `LEADELY_DESIGN_SYSTEM_MANTINE.md` provide architecture/design intent; code takes precedence when those documents differ. Sections 19–23 cover the current Find, CRM, integrations, operating limits, and change log in detail.

---

## 1. Overview

**Leadely** is a multi-tenant Business Development & Sales workspace, evolved from BD Quote Tool. The product flow is **Find → Engage → Understand → Quote → Follow up → Close → Grow**. The quotation and SaaS foundations remain, surrounded by CRM and prospect discovery.

It lets tenants:

- Discover and install Pay per event Apify Actors; run scrapes and inspect actor-specific datasets
- Manage Companies, Contacts, Leads, Lists, Deals, pipeline stages, Tasks, and activities
- Record communications, meetings, sequence definitions/enrollments, and account plans
- Configure workspace BYOK AI, generate deal intelligence, and track quote engagement
- Build quotes from a module catalog
- Generate a client-facing slideshow
- Export Excel / PDF / service-contract DOCX
- Run an AI Brief that turns client requirements into modules + deliverables
- Manage clients, workspace branding, and team
- Pay for the SaaS plan via SePay (VietQR + Payment Gateway)
- Operate the platform: configure 4 plans, lock workspaces, inspect payments

**Account rule:** one account = one role = one workspace **or** one platform role. A single portal at `/app`.

**CJTEK internal defaults:** a company workspace seeds branding from `src/lib/default-data.ts` (CÔNG TY TNHH CAP SAINT JACQUES TEK / CJTEK).

| Item | Value |
| --- | --- |
| App name | `bd-tool-app` |
| Version | `0.1.0` |
| Domain | BD/Sales + CRM + quotation SaaS (Vietnam); commercial quotes in VND, Apify prices in USD |
| Supabase project | `bd-tool` |
| Project ref | `eewoirdimfpfborwdbzx` |
| Region | `ap-southeast-1` |
| Postgres | 17.6 |
| Deploy | Vercel |
| Local | `.\run-local.ps1` → http://localhost:3000 |

---

## 2. Tech stack

### 2.1 Runtime & UI

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | Next.js **16.2.10** (App Router, Turbopack) | `src/app` |
| Language | TypeScript 5 | |
| UI | React **19.2.4** + **Mantine 9.6** | `@mantine/core`, `@mantine/hooks`, `@mantine/form`, `@mantine/notifications` |
| Styling | **Mantine 9.6** CSS | `@mantine/core/styles.css` + PostCSS preset; no Tailwind |
| Font / theme | Repository theme and global styles | `src/theme`, `src/styles`, `src/app/globals.css` |
| Icons | lucide-react | |
| Proxy / session | `src/proxy.ts` (Next.js proxy; no `middleware.ts`) | Refresh session + gate `/app` |

### 2.2 Backend & data

| Layer | Technology | Notes |
| --- | --- | --- |
| Auth | Supabase Auth | Email/password + Google OAuth |
| Database | Supabase Postgres + RLS | Migration `supabase/migrations/20260829000000_init_saas.sql` |
| Storage | Supabase Storage bucket `logos` (public) | Workspace logos under `{workspaceId}/` |
| Share fallback | Vercel Blob (`@vercel/blob`) | Private JSON if no `public_quotes` row |
| Admin / webhook | Supabase service role | SePay webhook, billing cron, platform-admin bootstrap |
| Hosting | Vercel | Cron `0 2 * * *` → `/api/billing/cron` |

### 2.3 External integrations

| Service | Purpose |
| --- | --- |
| **SePay VietQR** | Bank-transfer QR; webhook records the credit |
| **SePay Payment Gateway** | Card / NAPAS / QR; checkout init + IPN |
| **9Router** | AI Brief (`NINE_ROUTER_*`) — OpenAI-compatible `/chat/completions` |
| **Google Drive** | Spreadsheet upload helper in `src/lib/google-drive.ts` | Currently unused in the SaaS UI |
| **Google OAuth (Supabase)** | Sign in with Google |
| **Apify** | Public Store catalog/pricing metadata; authenticated Actor execution and dataset ingestion |
| **Workspace BYOK AI** | OpenAI-compatible provider configured in Settings; encrypted key stored per workspace |

### 2.4 Export & media

| Library | Used for |
| --- | --- |
| exceljs | Quote `.xlsx` |
| jspdf | Quote `.pdf` |
| docx + file-saver | Service contract `.docx` |
| lz-string | Encode long share URLs (`?data=`) |
| jsonrepair | Repair malformed JSON from the AI model |
| pptxgenjs | Quote PowerPoint export support |

### 2.5 Scripts & local

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

`run-local.ps1`: checks Node, runs `npm install` if `node_modules` is missing, starts `next dev -p 3000` (or `-Port 3001`).

---

## 3. System architecture

```
Browser
  │
  ├─ Public:  /  /login  /signup  /forgot  /pricing  /p/[id]  /invite/[token]
  ├─ App:     /app/*  (workspace or platform)
  └─ API:     /api/ai/brief  /api/share  /api/billing/*
        │
        ▼
Next.js (Vercel)  ── proxy.ts ── Supabase Auth getClaims()
        │
        ├─ Server Actions  (auth, db, billing, platform)
        ├─ Route Handlers  (AI, share, SePay webhook, cron)
        └─ SSR pages
        │
        ▼
Supabase (Auth + Postgres RLS + Storage)
        │
        ├─ SePay webhook (service role) ── invoices / payments / subscriptions
        └─ Vercel Cron 02:00 UTC ── expire / past_due
```

**An account is always exactly one of three kinds:**

1. `onboarding` — logged in, no workspace, not a platform admin
2. `workspace` — member of exactly one workspace (`owner` | `admin` | `member`)
3. `platform` — `super_admin` or `support` (not a workspace member)

DB trigger `enforce_single_account_role` blocks being both a workspace member and a platform admin.

---

## 4. Route map

### 4.1 Public / marketing

| Path | Description |
| --- | --- |
| `/` | Landing: hero + 4 public plans from `plans` |
| `/pricing` | Redirect `/#pricing` |
| `/login` | Email/password + Google |
| `/signup` | Sign up (password ≥ 8 characters) |
| `/forgot` | Send password-reset email |
| `/auth/callback` | Exchange OAuth/email code → session, redirect `next` |
| `/onboarding` | Create workspace (personal/company + choose plan) |
| `/invite/[token]` | Accept workspace or platform invite (`?kind=platform`) |
| `/p/[id]` | Public slideshow by share id |
| `/p` | Public slideshow from `?data=` (lz-string) |

### 4.2 Workspace portal (`/app`)

Gate: authenticated + `kind === workspace`. Layout `src/app/app/layout.tsx` + `AppShell`.

| Path | Who sees it | Function |
| --- | --- | --- |
| `/app` | owner, admin, member | BD dashboard: pipeline, revenue/forecast, tasks, leads, top companies, assistant panel |
| `/app/leads/sources` | all; install/remove: owner/admin + plan | PPE-only catalog, responsive cards, pricing, search and filters |
| `/app/leads/scrape` | workspace + plan checks on actions | Run history, actor/status/date/search filters |
| `/app/leads/scrape/new` | workspace + plan | Actor selector, input form, optional `?rerun={jobId}` |
| `/app/leads/scrape/[jobId]` | workspace | Dataset explorer, inputs/processing and CRM import |
| `/app/data` | workspace | Legacy redirect to scrape run history; normalized records remain available to AI/MCP internally |
| `/app/companies`, `/app/companies/[id]` | workspace | Company records and related CRM context |
| `/app/contacts`, `/app/contacts/[id]` | workspace | Contacts and relationships |
| `/app/leads`, `/app/leads/[id]` | workspace | Lead management and qualification |
| `/app/lists`, `/app/lists/[id]` | workspace | Lead lists, members and exports |
| `/app/deals`, `/app/deals/[id]` | workspace | Deal board, stages, stakeholders, quotes, contracts, intelligence |
| `/app/tasks` | workspace | Task creation and completion |
| `/app/inbox` | workspace | Manual communication log and integration placeholders |
| `/app/calendar` | workspace | Stored meetings; not external calendar synchronization |
| `/app/sequences`, `/app/sequences/[id]` | workspace | Sequence definitions, steps and enrollments |
| `/app/contracts` | workspace | Contract management |
| `/app/quotes` | workspace | Quote listing |
| `/app/quotes/new` | all | 4-step quote wizard |
| `/app/quotes/[id]` | all | Edit quote |
| `/app/clients` | all | Legacy redirect to `/app/companies` |
| `/app/modules` | all (add: owner/admin) | Workspace module catalog |
| `/app/settings` | all (save: owner/admin) | Branding, VAT, terms, convert to company, import legacy JSON |
| `/app/team` | owner, admin | Invite admin/member (`company` workspaces only) |
| `/app/billing` | owner | Pick plan, create invoice, VietQR, Gateway, history |

### 4.3 Platform portal

Gate: `kind === platform`. `/app/platform` is an operations overview, not a redirect.

| Path | Role | Function |
| --- | --- | --- |
| `/app/platform/plans` | super_admin edits plans; support can view | 4 plan slots + invite platform admins |
| `/app/platform/workspaces` | both | Workspace list, lock / unlock |
| `/app/platform/payments` | both; action-specific guards | Invoice/payment filters; loader capped at 1,000 invoices |
| `/app/platform` | platform | Tenant health, money, job status, catalog sync entry point |
| `/app/platform/accounts` | platform; action-specific guards | Accounts, invitations, login bans, password resets, platform roles |
| `/app/platform/workspaces/[id]` | platform; action-specific guards | Members, notes, billing, plan overrides, archive/purge and export |
| `/app/platform/health` | platform; action-specific guards | Configuration, integration heartbeats, feature switches, billing run |
| `/app/platform/audit` | platform | Platform operation audit trail |

`requirePlatform("super_admin")` sends support users away from super-admin-only pages to `/app/platform/workspaces`.

### 4.4 API

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| `POST` | `/api/ai/brief` | session + AI quota | Call 9Router, return JSON brief |
| `POST` | `/api/share` | session + workspace | Create `public_quotes`, return `/p/{id}` |
| `GET` | `/api/share/[id]` | public | Share payload (DB then Blob) |
| `POST` | `/api/billing/sepay/webhook` | `SEPAY_WEBHOOK_SECRET` | Record payment |
| `GET` | `/api/billing/cron` | `CRON_SECRET` | Expire / past_due subscriptions |
| `GET` | `/api/integrations/apify/sync-store` | `CRON_SECRET` | Catalog sync; Node runtime, maxDuration 300 |
| `POST` | `/api/integrations/apify/webhook` | Per-job `jobId` + secret | Terminal-run notification; claim and ingest dataset |
| `GET` | `/api/lists/[id]/export` | workspace | List CSV/XLSX export |
| `POST` | `/api/share/[id]/engage` | Public share + admission limit | Record opened/section/download/accepted/rejected events |
| `GET` | `/api/platform/workspaces/[id]/export` | platform guard | Workspace data export |

### 4.5 Proxy rules (`src/proxy.ts`)

- Refresh the session cookie on every request
- Unauthenticated access to `/app` or `/onboarding` → `/login?next=...`
- Authenticated access to `/login`, `/signup`, `/forgot` → `/app`

---

## 5. Auth, roles, session

Files: `src/lib/auth/actions.ts`, `src/lib/auth/session.ts`.

### 5.1 Sign up / sign in

| Action | Details |
| --- | --- |
| `signUpWithPassword` | Email + password ≥ 8. Invite token is accepted immediately. Session present → onboarding. No session → confirm email |
| `signInWithPassword` | Login; if no role yet, try platform bootstrap, else onboarding |
| `signInWithGoogle` | Google OAuth, `redirectTo` `/auth/callback?next=...` |
| `resetPassword` | `resetPasswordForEmail` |
| `signOut` | Sign out → `/login` |

Profiles are created by trigger `handle_new_user` on `auth.users` → `public.profiles` (email, display_name).

### 5.2 Workspace roles

| Role | Main permissions |
| --- | --- |
| **owner** | Full: settings, modules, team, billing, convert personal→company, import data, remove members (not self) |
| **admin** | Settings, modules, invite team; **no** billing |
| **member** | Quotes, clients, view catalog/settings; no invite, no settings/module edits, no billing |

Each workspace has exactly **one owner** (partial unique index).

### 5.3 Platform roles

| Role | Permissions |
| --- | --- |
| **super_admin** | Edit 4 plans, invite platform admins, lock workspaces, view payments |
| **support** | View workspaces/payments, lock workspaces; cannot edit plans or invite platform staff |

**First super_admin bootstrap:** `PLATFORM_BOOTSTRAP_EMAIL` matches the login email, `platform_admins` is empty, and `SUPABASE_SERVICE_ROLE_KEY` is set. After that, bootstrap never runs again.

### 5.4 Invites

**Workspace invite** (`createInviteAction`):

- Owner/admin only, workspace type `company`
- Enforces `seats` quota
- Cannot invite an account that already has a workspace or platform role
- Raw token on the URL; DB stores SHA-256 (`token_hash`)
- Expires in 7 days
- Accept: email must match; account must be `onboarding`

**Platform invite** (`createPlatformInviteAction`):

- super_admin only
- Role `support` or `super_admin`
- URL `/invite/{token}?kind=platform`

---

## 6. Workspace & onboarding

`createWorkspaceAction`:

1. Choose type `personal` | `company` and `planId`
2. Insert `workspaces` (unique slug + random suffix)
3. Insert owner into `workspace_members`
4. Insert `workspace_settings` (company uses CJTEK defaults; personal uses the user’s name)
5. Copy all `module_templates` → workspace `modules`
6. Insert `subscriptions`
   - Free → `active`, period ~ 120 months
   - Paid + `trial_days` > 0 → `trialing`
7. Paid → redirect `/app/billing`; Free → `/app`

**Personal → company:** owner calls `convertToCompanyAction`, then can invite a team.

**Lock / expiry:**

- `locked = true` (manual platform lock)
- `plan_status` ∈ `expired` | `canceled` → red banner; cannot create/edit quotes; no AI
- `past_due` → amber banner; paid features still work during grace

---

## 7. Product features (workspace)

### 7.1 Dashboard (`/app`)

- CRM pipeline overview, won revenue and weighted open-deal forecast
- Today's tasks/meetings, recent leads, top companies and assistant/notification panels
- Quote-derived fallback data where applicable; this is no longer the quote-only dashboard

### 7.2 Companies and legacy clients

`/app/clients` redirects to `/app/companies`. Companies and Contacts are the current CRM identities. Legacy `clients` records remain for quotation compatibility; `ensureLegacyClientForCompany` bridges them. The following client fields describe that quotation representation.

Stores:

- Company, contact name, email, phone
- Tax code, address, representative title, authorization document
- Logo (compressed JPEG data URI, max ~200px)
- Industry, notes

Used when picking a client on a quote, on the slideshow (client logo), and in Excel/PDF/contract.

### 7.3 Module catalog (`/app/modules`)

**Per-workspace** catalog, seeded from 15 system templates:

| # | Module | Category | Suggested price (VND) |
| --- | --- | --- | --- |
| 1 | Discovery & Requirement Workshop | Discovery | 8,000,000 |
| 2 | UI/UX Design | Product | 25,000,000 |
| 3 | Landing Page / Marketing Website | Product | 18,000,000 |
| 4 | User Authentication | User | 22,000,000 |
| 5 | User Profile Management | User | 12,000,000 |
| 6 | Admin Dashboard | Admin | 28,000,000 |
| 7 | Content Management | Admin | 18,000,000 |
| 8 | Product / Service Catalog | Commerce | 24,000,000 |
| 9 | Cart & Checkout Flow | Commerce | 26,000,000 |
| 10 | Payment Gateway Integration | Commerce | 18,000,000 |
| 11 | Third-party API Integration | Integration | 16,000,000 |
| 12 | Email / Push Notification | Integration | 12,000,000 |
| 13 | QA Testing & UAT Support | Quality | 15,000,000 |
| 14 | Deployment & Go-live | Quality | 10,000,000 |
| 15 | Maintenance & Support | Support | 12,000,000 |

Owner/admin can add custom modules (default category `Product`). Members view only. Clicking a module in the quote editor adds a line item.

### 7.4 Quote editor (4 steps)

File: `src/components/bd-tool/quote-editor.tsx`.

**Quote model**

| Field | Meaning |
| --- | --- |
| `publicId` | Public code (also used for contract number if empty) |
| `status` | `draft` \| `sent` \| `won` \| `lost` |
| `projectType` | Web App, Mobile App, MVP, Internal Tool, Maintenance, Custom Software |
| `items[]` | Commercial line items: name, description, qty, unitPrice |
| `deliverables[]` | Delivery appendix (priority High/Medium/Low = Cao/Trung/Thấp) |
| `discount` | % discount on subtotal |
| `vatRate` | % VAT |
| `validUntil` | Validity (default +`quoteValidityDays`) |
| `projectOverview` / `timeline` / `nextSteps` | Presentation copy |
| `contractNumber` | Contract no.; if empty `{last 4 of publicId}{YY}/{prefix}` |
| `paymentMilestones[]` | Default 70% on signing + 30% on acceptance |
| `techStack[]` | Default React/Next/Mantine/PostgreSQL |
| `warrantyMonths` / `maintenanceFeeMonthly` | Warranty & maintenance |

**Money formula** (`src/lib/money.ts`):

```
subtotal        = Σ qty × unitPrice
discountAmount  = subtotal × discount/100
taxableAmount   = subtotal − discountAmount
vatAmount       = taxableAmount × vatRate/100
grandTotal      = taxableAmount + vatAmount
```

**Step 1 — Brief & client**

- AI Brief assistant (send requirements + catalog → apply onto the quote)
- Pick client, project type, title, overview

**Step 2 — Catalog & line items**

- Click a module to add an item
- Edit qty/price, add custom line items
- “Generate deliverables” (`deliverablesFromItems`)

**Step 3 — Timeline & payment**

- Validity date, contract number, timeline, next steps

**Step 4 — Preview & export**

- Save draft / mark sent
- Copy public link (`/p/{shareId}`)
- Excel, PDF, DOCX
- In-app slideshow

**Quota on new quotes:** `usage_counters.quotes_created` per UTC month `YYYY-MM`. `-1` = unlimited. Updating an existing quote does not increment quota.

### 7.5 AI Brief

`POST /api/ai/brief` supports workspace BYOK through the AI provider layer, with platform 9Router as the platform path. See section 21 for provider selection and quota boundaries.

- Platform AI consumes `ai_briefs`; BYOK selection and admission control are handled separately
- Timeout ~60s (Vercel Hobby)
- Prompt requires the model to return **exactly one JSON object**
- `jsonrepair` if JSON is broken
- Max 5 modules, 8 deliverables

Output (`AiBriefResult`): projectName, projectType, executiveSummary, businessGoals, targetUsers, assumptions, outOfScope, modules (qty/unitPrice/pricingReason), deliverables (priority, effortDays, acceptanceCriteria), timeline, recommendedTechStack, risks, clarifyingQuestions.

Applying a brief overwrites title, type, overview, items, deliverables, timeline, techStack.

### 7.6 Slideshow

Slides are built from the quote:

| Layout | Content |
| --- | --- |
| cover | Quote title, client, project type, validity |
| split-left | Workspace about (about, tax code, address) |
| split-right | Project goals + tech stack |
| grid | Quote line items (6 per slide) |
| grid | Deliverables |
| numbered | Timeline / payment milestones |
| stat | Grand total + breakdown |
| closing | Next steps + terms |

Public `/p/[id]` reads the payload. Quote delivery also supports generated deck styles and uploaded PDF proposals. `share_no_watermark` is not part of the current parsed plan feature set.

### 7.7 Export

| Format | File | Content |
| --- | --- | --- |
| Excel | `Bao-gia_{client}_{title}_{date}.xlsx` | Branding, line-item table, totals, terms |
| PDF | same pattern `.pdf` | jsPDF, accent branding |
| DOCX | Service contract | Contract no., parties A/B, scope, deliverables, fees, milestones, VN legal clause library (`legal-library.ts`: definitions, IP, confidentiality, penalties, force majeure, disputes, warranty…) |
| PPTX | Quote deck | `src/lib/quotes/export-pptx.ts`; quote delivery/deck components |

Private `presentations` and `contracts` buckets store uploaded proposal PDF and contract DOCX files (20 MiB limit in the file actions), with workspace paths and expiring signed URLs. Quote fields include `deck_style`, `presentation_source`, and proposal file metadata; contracts have `docx_path`/`docx_name`.

Contract disclaimer: drafting aid only, not a substitute for legal advice.

### 7.8 Public quote share

Three paths:

1. **Preferred:** insert `public_quotes` (8-char id) + JSON payload → URL `/p/{id}`
2. **GET fallback:** if no row, read private Vercel Blob
3. **Legacy URL:** `/p?data=` lz-string compressed (strips data-URI logos for shorter URLs)

Payload: `{ settings, client, quote }`.

### 7.9 Workspace settings

- Full name / short name, logo path, accent `#2FF29E`
- Tax code + legal representative (shown when `company`)
- Address, email, phone, website
- VAT %, quote validity days
- About, terms (one clause per line)
- Bank details, contract-number prefix (`HDDV-CJTEK`), default warranty, maintenance fee
- Personal owner: **Upgrade to company**
- Owner: **Import JSON** from localStorage key `csj-bd-tool-data-v1` (pre-SaaS tool)

### 7.10 Team

Company only. Email + role admin/member → link `/invite/{token}`. Member list (email, display name, role).

---

## 8. SaaS management (billing & plans)

This is **BD Tool’s own subscription**, not the software quotes sold to end clients.

### 8.1 Four fixed plan slots

Table `plans`: exactly 4 rows, unique `slot` 1–4. Platform **cannot create extra plans**; it only edits the 4 slots.

Current seed:

| Slot | Name | Slug | Monthly | Yearly | Trial | Seats | Quotes/mo | AI/mo | Badge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Free | free | 0 | 0 | 0 | 1 | 5 | 3 | |
| 2 | Starter | starter | 199,000 | 1,990,000 | 14 | 1 | 30 | 20 | |
| 3 | Pro | pro | 499,000 | 4,990,000 | 14 | 5 | unlimited (−1) | 100 | Phổ biến |
| 4 | Business | business | 1,299,000 | 12,990,000 | 14 | 20 | unlimited | 300 | |

Prices are integer VND. Super admin can change: name, badge, monthly/yearly price, trial_days, seats, quotes_per_month, ai_briefs_per_month, is_public.

### 8.2 Plan feature flags

Stored JSON `features`:

| Flag | Seed | Intended meaning |
| --- | --- | --- |
| `export_docx` | all true | Export contract DOCX |
| `custom_branding` | Free false, others true | Workspace branding |
| `contracts` | all true | Contract module |
| `byok_ai` | configurable | Workspace OpenAI-compatible provider |
| `lead_scrape` | configurable | Install and run scrape sources |

The parsed feature set is exactly `export_docx`, `custom_branding`, `contracts`, `byok_ai`, `lead_scrape`. Historical seed JSON may contain older flags; that does not make them supported runtime entitlements. Plan values can be changed by platform admins and patched by workspace overrides. BYOK and scrape actions enforce their plan flags; do not assume all legacy export/branding controls enforce every flag identically.

### 8.3 Subscription lifecycle

Table `subscriptions` is 1–1 with a workspace.

`status` / `workspaces.plan_status`:

| Status | Meaning |
| --- | --- |
| `trialing` | On trial; after `current_period_end` → past_due |
| `active` | Current period paid |
| `past_due` | Overdue, still inside `grace_days` (default 7) |
| `expired` | Grace over — lock quote create/edit & AI |
| `canceled` | Canceled — treated as locked |

Cron `GET /api/billing/cron` daily at 02:00 (Vercel):

- `now > period_end` and not yet past_due → `past_due`
- `now > period_end + grace_days` → `expired`

Header `Authorization: Bearer $CRON_SECRET` (or `?secret=`).

### 8.4 Checkout (owner)

1. Pick a paid plan + monthly/yearly interval
2. Optional: request VAT invoice + tax code
3. `createCheckoutInvoice` → `invoices` status `pending`, `payment_code` like `BD-XXXXXXXX`
4. Screen:
   - **VietQR:** image `https://qr.sepay.vn/img?acc=&bank=&amount=&des={payment_code}`
   - **Gateway:** `POST {SEPAY_GATEWAY_BASE_URL}/v1/checkout/init` (Basic auth + HMAC SHA-256 `X-Signature`)

SePay is **not recurring**: the owner creates a new invoice each period. The app extends `current_period_end` when the webhook marks paid.

### 8.5 Payment webhook

`POST /api/billing/sepay/webhook`

- Verify secret (Authorization / `x-sepay-signature`, timing-safe)
- Idempotent on `payments.sepay_id`
- Ignore `transferType !== in`
- Match invoice: `code` = `payment_code` or `content` contains the code
- `amount >= invoice.amount`
- Insert `payments`, invoice `paid`, subscription `active`, workspace `plan_id` + `plan_status = active`
- Extend period: +1 month or +12 months from `current_period_end`

Channel: `vietqr` (when gateway/transferType present) or `gateway`.

### 8.6 Usage counters

PK `(workspace_id, period)` with `period = YYYY-MM` UTC.

- `quotes_created`
- `ai_briefs`
- `maps_scrapes` (also used for generic Actor runs)
- `maps_places`
- `maps_people`

Quota `-1` = unlimited.

`consume_quota` performs atomic quota consumption. `admit`, `acquire_hold`, and `release_hold` provide rate/concurrency control. These counters are not a USD billing ledger for Apify.

---

## 9. Platform admin (running the SaaS)

Same portal, different sidebar from workspace.

The original screens below remain; the current operations expansion is listed in section 4.3 and detailed in section 22.3.

| Screen | What it does |
| --- | --- |
| Plans | Form for 4 slots; invite email as support/super_admin, return a link |
| Workspaces | Name, type, plan_status, locked; Lock / Unlock |
| Payments | `payment_code`, amount, status |

Platform RLS: `is_platform_admin()` can read cross-tenant workspaces/invoices. Plan updates require `platform_role() = super_admin`.

---

## 10. Data model

Schema source: the entire ordered `supabase/migrations/` chain, not only the initial SaaS migration. Types: `src/lib/database.types.ts`. See section 22 for the migration inventory.

### 10.1 Tables

| Table | Role |
| --- | --- |
| `plans` | 4 SaaS plans |
| `profiles` | Email/name, synced from Auth |
| `workspaces` | Tenant: personal/company, plan, status, locked |
| `workspace_members` | Membership; unique 1 user → 1 workspace |
| `platform_admins` | super_admin / support |
| `workspace_settings` | Branding & legal |
| `module_templates` | System catalog (seed) |
| `modules` | Per-workspace catalog clone |
| `clients` | Workspace clients |
| `quotes` | Quotes; JSONB items/deliverables/milestones |
| `public_quotes` | Public slideshow payload |
| `invites` | Team invites |
| `platform_invites` | Platform invites |
| `usage_counters` | Monthly quotas |
| `subscriptions` | Billing period |
| `invoices` | SaaS invoices |
| `payments` | SePay transactions |

### 10.2 SQL helpers

- `current_workspace_id()`, `current_member_role()`
- `is_platform_admin()`, `platform_role()`
- `set_updated_at` trigger
- `handle_new_user` → profiles
- `enforce_single_account_role`

### 10.3 RLS (summary)

- RLS on every public table
- Members only see `workspace_id = current_workspace_id()`
- `plans` readable if public or logged in; update super_admin only
- `public_quotes` SELECT for anyone who knows the id
- `module_templates` SELECT true
- `logos` bucket public read; write folder = workspace id
- Invites: owner/admin write; invitee can read by email

Service role (webhook/cron/bootstrap) bypasses RLS.

### 10.4 Storage

Bucket `logos`, public. Path `{workspaceId}/...`.

Private buckets `presentations` and `contracts` store workspace-scoped PDF/DOCX files. `src/lib/logo-storage.ts` uploads JPEG branding to `logos`; the previous missing-upload note is obsolete.

---

## 11. Server actions catalog

### Auth — `src/lib/auth/actions.ts`

`signUpWithPassword`, `signInWithPassword`, `signInWithGoogle`, `resetPassword`, `signOut`, `createWorkspaceAction`, `convertToCompanyAction`, `createInviteAction`, `acceptInvite`, `acceptPlatformInvite`, `createPlatformInviteAction`

### Workspace data — `src/lib/db/actions.ts`

`loadWorkspaceAppData`, `saveSettingsAction`, `createClientAction`, `updateClientLogoAction`, `createModuleAction`, `saveQuoteAction`, `createShareAction`, `consumeAiQuotaAction`, `importLocalDataAction`

### Billing — `src/lib/billing/actions.ts`

`createCheckoutInvoice`, `loadBilling`, `initGatewayCheckout`, `applySepayPayment`, `runBillingCron`

### Platform — `src/lib/platform/actions.ts`

`updatePlanAction`, `loadPlatformPlans`, `loadPlatformWorkspaces`, `loadPlatformPayments`, `lockWorkspaceAction`

### Session guards — `src/lib/auth/session.ts`

`getSessionContext`, `requireUser`, `requireWorkspace`, `requireOwner`, `requireOwnerOrAdmin`, `requirePlatform`

---

## 12. Main directory layout

```
src/app/                 pages + API
src/components/          app-shell, auth, billing, team, onboarding
src/components/bd-tool/  quote-editor, slideshow, AI, clients, modules, settings
src/lib/auth/            login, invite, workspace create
src/lib/billing/         invoice, SePay, cron
src/lib/db/              mappers + workspace CRUD
src/lib/platform/        SaaS admin
src/lib/contracts/       DOCX + legal library
src/lib/ai/              AI brief types
src/lib/supabase/        browser, server, admin, proxy
src/features/           CRM, leads/scrape, lists, deals, tasks, communications, AI
src/components/leadely/  shared panels, tables, dashboard components
src/lib/quotes/          proposal/contract file actions and PowerPoint export
src/theme/              Mantine theme
src/styles/             shared CSS modules
scripts/                demo seed and catalog pricing backfill
supabase/migrations/     schema
```

**Legacy import:** `src/lib/storage.ts` can parse the old localStorage JSON (`csj-bd-tool-data-v1`) so Settings can import it into Postgres. The previous local-first UI (`bd-tool-app.tsx`) has been removed.

---

## 13. Environment variables

Template: `.env.example`. Local: `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook, cron, bootstrap | Bypass RLS |
| `NEXT_PUBLIC_SITE_URL` | yes | Callbacks, invites, share, gateway return URLs |
| `PLATFORM_BOOTSTRAP_EMAIL` | first run | First super_admin email |
| `NINE_ROUTER_BASE_URL` | AI | OpenAI-compatible base |
| `NINE_ROUTER_API_KEY` | AI | Bearer |
| `NINE_ROUTER_MODEL` | AI | Model name |
| `SEPAY_BANK_ACCOUNT` | VietQR | Receiving account |
| `SEPAY_BANK_NAME` | VietQR | Bank name (e.g. vietcombank) |
| `SEPAY_BANK_BIN` | optional | BIN |
| `SEPAY_WEBHOOK_SECRET` | webhook | SePay API key |
| `SEPAY_MERCHANT_ID` | Gateway | |
| `SEPAY_SECRET_KEY` | Gateway | HMAC + Basic |
| `SEPAY_GATEWAY_BASE_URL` | Gateway | default `https://pgapi-sandbox.sepay.vn` |
| `CRON_SECRET` | cron | Bearer |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Drive (legacy) | GIS |
| `APIFY_OAUTH_CLIENT_ID` / `APIFY_OAUTH_CLIENT_SECRET` | Apify OAuth | OAuth application credentials; never used directly to run Actors |
| `APIFY_OAUTH_AUTHORIZATION_URL` / `APIFY_OAUTH_TOKEN_URL` | Apify OAuth | Authorization and token endpoints supplied by Apify |
| `WORKSPACE_SECRETS_KEY` | BYOK production configuration | Stable key material for AES-256-GCM encryption; code falls back to service-role key, then a development fallback |

This table lists names only: never copy real API keys, tokens, demo passwords, or webhook secrets into this document. `.env.example` may lag supported integration variables; inspect the consumers above when provisioning.

Remote images: hostname `eewoirdimfpfborwdbzx.supabase.co` in `next.config.ts`.

---

## 14. Security

- RLS on by default for schema `public`
- Invite tokens stored as SHA-256 hashes only
- Payment codes random `BD-` + hex
- SePay webhook secret compared timing-safe
- Cron requires a secret
- Service role is **not** exposed via `NEXT_PUBLIC_`
- One user cannot hold two roles (DB trigger)
- Share id is 8 chars, 5 retries on collision
- Logo storage writes only to the current workspace folder

Pausing the free Supabase project causes `AuthRetryableFetchError` — proxy `getClaims()` hangs and the page looks blank/slow. Unpausing fixes it.

---

## 15. User flows (summary)

```
Signup/Login
    │
    ├─ PLATFORM_BOOTSTRAP_EMAIL + empty admin table → super_admin → /app/platform/plans
    ├─ Workspace/platform invite → accept → /app or platform
    └─ Onboarding → personal|company + plan
            │
            ├─ Free → /app (create quotes)
            └─ Paid → /app/billing (trial / pay)
                    │
                    Owner creates invoice → VietQR transfer or Gateway
                    SePay webhook → active
                    Cron on expiry → past_due → expired
```

**Create a quote:** Clients → (optional Modules) → Quotes new → AI/catalog → save → share `/p/id` or Excel/PDF/contract.

**Team:** personal → Upgrade to company → Team invite by email.

---

## 16. Implementation status

Implemented in the local codebase (deployment status is separate):

- Multi-tenant + 1 account 1 role
- 4 configurable plans
- Quote / AI / seat quotas
- Trial, VietQR, Gateway, webhook, expire cron
- Platform lock workspace
- Quote + slideshow + Excel/PDF/DOCX + public share
- AI Brief via 9Router
- Team & platform invites
- Import legacy localStorage data
- CRM entities, pipeline, tasks, manual communications/meetings, account plans
- Sources PPE card catalog and pricing metadata, scrape history/new/detail routes
- Generic dataset explorer, CSV/JSON export, Maps-specific CRM import and Lead Lists
- Workspace BYOK, quote revisions/engagement, deal intelligence, proposal/contract file storage
- Platform overview/accounts/health/audit, workspace overrides and operational actions

Missing / partial (see section 23 for operational details):

- Consistent enforcement of all legacy presentation/export entitlements requires a separate audit
- External Gmail/Outlook/Calendar connections are placeholders; manual records do not send or sync messages
- Sequence execution/sending worker is not implemented by the definition/enrollment screens
- Generic Actor → CRM field mapping/import is not implemented
- Apify per-run USD caps, workspace spend accounting and live pricing validation at run start are not implemented
- Automatic SePay recurring charges (intentional: the app manages periods)
- Automatic invite emails (currently copy-link)

---

## 17. Local & production operations

**Local**

1. Copy `.env.example` → `.env.local` and fill keys
2. Supabase project `bd-tool` must be **ACTIVE** (paused = slow/blank pages)
3. `.\run-local.ps1` or `npm run dev`
4. SePay webhook needs a public URL (tunnel) pointing at `POST /api/billing/sepay/webhook`
5. Apify webhook likewise needs a public callback URL; localhost alone is not reachable by Apify. Manual refresh checks the run status before ingestion.

**Production (Vercel)**

- Env vars as in section 13
- Cron in `vercel.json`: `0 2 * * *` → `/api/billing/cron`
- SePay production: change `SEPAY_GATEWAY_BASE_URL` + bank account + webhook secret
- `NEXT_PUBLIC_SITE_URL` = real domain

**Ops bootstrap**

1. Set `PLATFORM_BOOTSTRAP_EMAIL` to the ops email
2. Sign up/in with that email while `platform_admins` is empty
3. Open `/app/platform/plans`, configure the 4 plans, invite support

---

## 18. Quick file index

| Topic | File |
| --- | --- |
| Schema | `supabase/migrations/20260829000000_init_saas.sql` |
| Entitlements | `src/lib/entitlements.ts` |
| Quote types | `src/lib/types.ts` |
| CJTEK defaults | `src/lib/default-data.ts` |
| Quote UI | `src/components/bd-tool/quote-editor.tsx` |
| Slideshow | `src/components/bd-tool/slideshow.tsx` |
| Contract | `src/lib/contracts/generate-docx.ts` |
| AI | `src/app/api/ai/brief/route.ts` |
| Billing | `src/lib/billing/actions.ts` |
| SePay | `src/lib/billing/sepay.ts` |
| Platform | `src/lib/platform/actions.ts` |
| Proxy | `src/proxy.ts` |
| Short README | `README.md` |
| CRM actions | `src/features/{companies,leads,deals,tasks,comms,lists}/server/` |
| Sources catalog | `src/features/leads/server/source-actions.ts`, `sync-store.ts` |
| Card pricing | `src/features/leads/server/source-card-details.ts`, `src/features/leads/source-pricing.ts` |
| Scrape execution | `src/features/leads/server/scrape-actions.ts`, `apify.ts` |
| Dataset viewer | `src/features/leads/components/dataset-explorer.tsx`, `src/features/leads/dataset.ts` |
| AI providers | `src/features/ai/server/providers.ts`, `complete.ts` |
| Platform operations | `src/lib/platform/ops.ts`, `flags.ts`, `audit.ts`, `heartbeat.ts` |

---

## 19. Find: Sources catalog and pricing

### 19.1 Catalog policy and UI

- Sources listing, catalog total, installed-source selector, and installed-ready list filter `pricing_model = PAY_PER_EVENT` and exclude archived sources.
- Installing a source also checks PPE on the server. Owner/admin plus `lead_scrape` entitlement are required.
- Other models remain stored in the database; this change does not delete actors, installations, or historical jobs.
- The current run actions do not independently re-check the pricing model. PPE listing/install restrictions are not a complete run-time pricing policy enforcement layer.
- `/app/leads/sources` uses responsive 4/3/2/1-column cards: actor image, title, slug, description, direct price, event details, install/remove action, author username, rating and compact user count.
- Rating displays the score only, without the review-count number in parentheses.
- Filters: name/description/slug search, installed/uninstalled, category; Sources uses its own page size of **200 Actors** (other lists keep their existing sizes). At the recorded 17,496 PPE Actors, this gives 88 pages. Ordering uses total users then ID; old out-of-range page URLs resolve to the last available page. The ready/preview dropdown was removed and legacy `adapter` URL parameters are ignored by the page.
- The author footer currently uses the slug username, not the publisher's full display name/avatar.

### 19.2 Price meaning and data sources

`scrape_sources.pricing_model` persists the model classification. Detailed event prices are **not persisted in this table** by the pricing backfill.

`source-card-details.ts` reads public Actor metadata (`/v2/acts/{username~name}`), selects the latest pricing entry whose `startedAt` has passed, and caches the response for one hour. The page fetches metadata in groups of six; the request timeout is eight seconds per Actor. This also supplies missing card images.

`source-pricing.ts` derives the display:

1. Only summarize PPE pricing.
2. Choose the primary event, otherwise the first non-one-time event, otherwise the first valid event.
3. Prefer the **Free-tier** price, falling back to an untiered event price. Do not substitute the lowest paid-tier price.
4. Display recurring events per 1,000 units using the Actor's event title. Display one-time events per one unit.
5. Expandable details show each available event's per-event price. A genuine zero price remains zero; missing prices are not invented.

These are reference USD prices, not quotes for a complete scrape or the connected account's effective paid-tier pricing. Add-ons, startup events, and separately billed resources can change the total. If metadata cannot be read, the card shows an unavailable-price message and an Apify link.

### 19.3 Sync behavior and known fix

- `syncLeadGenerationStore` queries the public Store in category `LEAD_GENERATION`, using popularity/newest/lastUpdate/relevance sorts, 100 items per page, and a 16,000-offset bound per sort.
- It inserts/updates sources, archives records not seen in the sync, and ensures the Maps source is ready. Pagination bounds and changing Store rankings mean completeness should not be assumed solely from a successful response.
- The old `responseFormat=agent` omitted `currentPricingInfo` and images. It was removed on 2026-09-24 so future syncs read full metadata.
- Full sync is available through the platform action and secret-protected API. **No catalog cron is currently scheduled in `vercel.json`**; only billing is scheduled.
- `scripts/sync-catalog-pricing.cjs` is a separate pricing-only backfill. It snapshots existing values and fetched pricing to a timestamped JSON file in the OS temp directory, retries transient HTTP failures, reads Store pages then remaining Actor details, and updates model values in batches. It never runs an Actor or changes installations/archives.
- `--missing-only` reads only catalog rows whose model is null and uses Actor details directly. It does not refresh prices of already classified rows.

```powershell
node --env-file=.env.local scripts/sync-catalog-pricing.cjs
node --env-file=.env.local scripts/sync-catalog-pricing.cjs --missing-only
```

Snapshot verified **2026-09-24**, active/non-archived records:

| Classification | Count | Product visibility |
| --- | ---: | --- |
| PAY_PER_EVENT | 17,496 | Shown in Sources |
| FREE (platform resource usage, not zero total cost) | 168 | Hidden |
| Missing pricing | 3 | Hidden |
| Total stored active catalog | 17,667 | Includes hidden models |

Unresolved slugs: `fayoussef/thebluebook-scraper`, `mirzini/maps-no-legal-entity-match`, `lentic_clockss/jseek-scraper`. Public Actor lookup returned 404; authenticated checks returned 401. This does not establish that the Actors were deleted. The last authenticated check did not establish a working Apify token; verify integration credentials before a real run.

## 20. Scrape runs, datasets and CRM import

### 20.1 User flow

1. Install a PPE source from Sources. Generic Actor installation retrieves/caches its input/output contract; Maps has a dedicated adapter.
2. `/app/leads/scrape` shows run history with query/actor/status/date filtering and 20-row presentation pages.
3. `/app/leads/scrape/new` selects an installed source. The dropdown contains an explicit **Tìm nguồn đã cài…** field, case/diacritic-insensitive matching, match count, scrollable options, and empty state.
4. Maps uses a specific form; other Actors use `ActorInputForm` generated from schema/example input. `?rerun={jobId}` prefills compatible inputs but does not auto-start a paid run.
5. Starting creates a workspace job, consumes a run quota, submits input to Apify, and stores run/dataset IDs.
6. Job detail separates results, optional Maps CRM import, original input, and processing metadata. Active-job tabs refresh the application view every 15 seconds while visible; that refresh is not an Apify polling request.

### 20.2 Data contract and ingestion

Job statuses: `queued`, `running`, `ingesting`, `succeeded`, `failed`, `canceled`.

- Jobs store `source_id`, `apify_actor_id`, query/input filters, run/dataset IDs, counters, timestamps and a server-side webhook secret.
- Generic output is stored as raw JSON in `lead_scrape_results`; result fields are not assumed to match Google Maps.
- Maps output is normalized to places and `lead_scrape_people`, with matching/import state and original raw data.
- `readAllPages` reads database pages until empty and advances by actual returned row count, handling a server cap lower than the requested batch size.
- Raw ingestion no longer truncates at 200 records. Existing ingest keys are read across all pages; inserts are batched by 200; retries skip already stored items. This supports recovery after a partially written batch.
- Job detail reads all results and people in paged database queries. The explorer still receives the complete dataset in memory; table pagination is not server-side dataset virtualization.
- Apify dataset download is currently a single fetch, so exceptionally large datasets still require memory/performance work.

### 20.3 Dataset explorer

`DatasetExplorer` supports arbitrary actor fields, nested paths, column selection, field/all-data search, numeric/text sort, paging, safe links, booleans and a detail drawer for nested objects/arrays and JSON.

CSV exports the filtered dataset with selected columns; JSON exports full fields of filtered records. CSV escaping includes formula-injection protection. Internal ingest markers are omitted from displayed/exported raw records. Nested object paths distinguish literal dots in keys from path separators.

### 20.4 Completion, refresh and import

- Apify notifies the per-job webhook on success/failure/abort/timeout. Ingestion is claimed atomically and run through `after(...)`; integration heartbeats record outcomes.
- Manual refresh checks the upstream run status before ingesting. Generic succeeded jobs can be re-ingested idempotently to backfill older truncated output.
- Upstream abort/timeout events currently map to local `failed`; the local `canceled` status is not evidence of a implemented public cancel-and-abort UI.
- Maps supports selected places/contacts → Company/Lead/Contact and optional Lead List import. Generic actors currently have no CRM import mapping.
- The extra **Chọn place / Chọn người — Tất cả / Bỏ hết** toolbar was removed from job detail. Individual/table selection controls remain; helper actions may still exist in source.
- The demo “phòng khám đa khoa” run was changed from running to canceled on 2026-09-24. It had Actor `demo` and no upstream run ID; no paid Actor was aborted. The seed script still defines its original running fixture, so reseeding can recreate it.

### 20.5 Limits that are implemented vs planned

Implemented: `lead_scrape` flag, installed-source checks, one unfinished workspace scrape enforced by the database, run quotas, Maps limits of 50 places and up to five enrichment records per place, and import/matching controls.

Not implemented: per-run `maxTotalChargeUsd`, a universal generic-Actor result cap, workspace USD budget ledger, final cost reconciliation, and live pricing-model validation in every start action. Generic jobs' stored `max_results = 20` is not automatically imposed on Actor input. Actor execution requires an Apify connection linked to the workspace. Connections support OAuth and encrypted user-supplied API tokens; one connection may be linked to multiple workspaces, while account RAM and billing remain shared at Apify account level.

## 21. CRM, engagement and AI implementation

### 21.1 Relationship and sales model

Companies/Contacts hold identity; Leads represent prospecting; Deals carry the commercial opportunity. Pipelines/stages define progress and probability; deal contacts track stakeholders. Tasks, activities, communications, meetings, quotes and contracts attach to those entities through workspace-scoped relationships.

- Company/contact list and detail actions support creation and editing; the legacy client bridge keeps existing quote generation compatible.
- Lead qualification creates/links a Deal through the lead actions.
- Deal board/stage actions and detail workspace provide stakeholder, activity, quote, contract and AI context.
- Lead Lists hold company/lead/contact memberships and support status updates and CSV/XLSX export. They are CRM collections, not arbitrary raw Actor datasets.
- Quote revisions and engagement events are separate records. Public engagement accepts `opened`, `section_viewed`, `pdf_downloaded`, `accepted`, `rejected`, applies an admission limit, and can create notifications/activity. These events do not by themselves implement an electronic signature service.

### 21.2 Communication scope

Inbox writes manual communication records; Calendar stores meetings. Integration settings currently record disconnected placeholders. Sequence UI stores sequences, steps and enrollments; there is no configured sending/scheduling worker in the checked route/cron inventory. Account plans store structured company planning information.

Do not describe these screens as connected Gmail/Outlook mailboxes, external calendar sync, or automatic outreach until their execution integrations exist.

### 21.3 AI and secrets

Settings now uses a horizontal tab bar (Workspace, Branding, Quote defaults, Legal & contract, Banking, Data, AI provider). Workspace is selected initially; the AI configuration form mounts only when its tab is selected. The general Save button is hidden on the AI tab, which has its own Test & save / Remove actions. Model/key inputs discourage browser credential autofill.

AI Brief and Deal intelligence both call `completeChat`, which resolves the workspace default provider/model centrally. Future AI features must use this shared gateway rather than independent provider settings. Current behavior falls back to platform AI when BYOK is absent, cannot be decrypted, or its request fails; platform availability and quota still apply. The Settings UI explicitly describes this fallback. This UI update did not make paid provider calls or change stored credentials.

`src/features/ai/server/complete.ts` centralizes OpenAI-compatible completion, workspace provider resolution, rate/concurrency gates and the platform provider path. Workspace BYOK is enabled by `byok_ai`; owner/admin can test/save/delete providers in Settings. Key material is encrypted with AES-256-GCM, and provider display queries omit the encrypted key.

Platform AI fallback uses `NINE_ROUTER_BASE_URL`, `NINE_ROUTER_API_KEY`, `NINE_ROUTER_MODEL` and platform AI quota. Apify is separate: Actor execution requires an OAuth or encrypted API-token connection linked to the workspace, with no shared server token or fallback account. Use a stable `WORKSPACE_SECRETS_KEY`; changing encryption key material without migration prevents reading existing encrypted credentials.

Deal intelligence generates structured recommendations using deal context. Quote AI Brief remains part of the quotation workflow. UI presence does not establish successful live provider connectivity.

## 22. Schema and operations inventory

### 22.1 Ordered migrations in the repository

| Migration | Scope |
| --- | --- |
| `20260829000000_init_saas.sql` | Auth/workspace roles, plans, quote foundation, billing, initial RLS |
| `20260921000000_crm_foundation.sql` | Companies, Contacts, Leads, Deals, pipelines, stakeholders, tasks, activities |
| `20260921000001_crm_data_migration.sql` | Bridge/migrate legacy quotation data into CRM |
| `20260921000002_find_byok_quote_intel.sql` | Scrape staging, Lists, BYOK, engagement, contracts, notifications, communications, sequences, account plans |
| `20260923120000_quote_deck_files.sql` | Deck/proposal metadata and private presentations/contracts buckets |
| `20260923130000_contract_docx.sql` | Contract DOCX fields |
| `20260923180000_load_control.sql` | Atomic quotas, admission windows/holds, scrape concurrency/status and matching helpers |
| `20260923220000_platform_ops.sql` | Platform audit/flags/heartbeats, workspace overrides/notes, invoice archive, role operations |
| `20260924010000_scrape_sources.sql` | Actor catalog, workspace installations, job source relation, default Maps installation |
| `20260924030000_scrape_source_contract.sql` | Cached input/output schemas and example input |

Migration presence is not proof of application in every environment. The 2026-09-24 UI changes did not add a new database migration.

### 22.2 Additional tables beyond the SaaS foundation

| Area | Tables |
| --- | --- |
| CRM | `companies`, `contacts`, `pipelines`, `pipeline_stages`, `leads`, `deals`, `deal_contacts`, `tasks`, `activities` |
| Discovery | `scrape_sources`, `workspace_scrape_sources`, `lead_scrape_jobs`, `lead_scrape_results`, `lead_scrape_people` |
| Lists | `lead_lists`, `lead_list_members` |
| AI / quotation intelligence | `workspace_ai_providers`, `quote_engagement_events`, `contracts`, `notifications` |
| Engagement | `integration_connections`, `communications`, `meetings`, `sequences`, `sequence_steps`, `sequence_enrollments`, `account_plans` |
| Load control | `admission_windows`, `admission_holds` |
| Platform ops | `platform_audit_log`, `platform_flags`, `integration_heartbeats`, `workspace_overrides`, `workspace_notes`, `invoice_archive` |

Tenant business tables use workspace scope and RLS. `scrape_sources` is a shared catalog with its own read policy, not a per-workspace table. Platform/global tables likewise have their own role policies. Service-role use must remain on trusted server/operations paths.

### 22.3 Platform operations

`src/lib/platform/ops.ts` adds account administration, workspace member/ownership operations, notes, billing adjustments, quota/feature overrides, archive/purge, invoice actions, share revocation, health and export. Action-specific role guards and database last-super-admin protection apply; do not infer permission solely from a navigation item.

`platform_flags` provides kill switches; `integration_heartbeats` records integration observations, and `platform_audit_log` records administrative changes. Configuration presence shown by Health does not validate credential correctness.

### 22.4 Development verification

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/app/app/leads/sources/page.tsx src/features/leads/server/source-actions.ts src/features/leads/server/source-card-details.ts src/features/leads/source-pricing.ts
npx.cmd --yes tsx --test src/features/leads/tests/dataset.test.ts src/features/leads/tests/ingest.test.ts src/features/leads/tests/source-pricing.test.ts
npm.cmd run build
```

The dataset/ingestion tests cover late/nested fields, literal-dot paths, sorting, CSV safety, paged reads past database caps, >1,000 raw records, retry without duplicates and Maps contact mapping. Pricing tests cover primary-event selection, Free-tier choice, startup charges, zero and missing prices.

Type checking, scoped lint and the relevant tests passed during implementation. A production build passed after the scrape redesign; the later Sources-card change was checked with type/lint/tests and browser checks, not a new production build. This documentation update itself does not claim a fresh full regression run or deployment.

## 23. Current limitations and 2026-09-24 change record

Completed changes:

- Separated scrape history, new-run form and run detail; made results Actor-specific rather than Maps-only.
- Added dataset discovery, selection/search/sort, nested detail and CSV/JSON export.
- Removed 200-row raw-ingestion truncation and paged result reads beyond default database caps.
- Added an explicit installed-source search field and removed redundant CRM bulk-selection toolbar.
- Canceled the identified running demo fixture.
- Removed Sources ready/preview filter, repaired full Store metadata retrieval and backfilled pricing model classifications.
- Restricted Sources and source selectors to PPE; replaced the table with cards showing actual event prices and rating without review counts.

Remaining limitations:

- PPE classification alone does not guarantee low cost, included resource usage, good output or reliability. Card price is a reference unit price, not a run budget.
- Missing/unreachable Actor pricing remains unknown. Pricing metadata can change between sync, cached display and execution.
- Source metadata is fetched during page rendering; cache misses and upstream timeouts can delay a page. Detailed pricing is not yet a persisted, versioned catalog price ledger.
- Raw dataset browsing loads all rows into memory; large-scale streaming/virtualization and paged upstream downloads remain future work.
- Generic CRM import, general UI cancellation/upstream abort, and complete financial controls for Apify remain unimplemented.
- External communications/sequences are data-management foundations, not live sending integrations.
- Recent Apify authenticated metadata probes returned 401; real run readiness must be checked with valid credentials and a reachable webhook. No paid Actor execution was used to validate these UI changes.

Maintain this document alongside future code changes. Update dated counts only after querying the database, distinguish seed fixtures from live execution, and keep implementation status separate from architecture proposals and production verification.
