# Leadely Dashboard Redesign — Cursor Implementation Spec

## Goal
Redesign the current Leadely desktop Dashboard so it visually matches the approved Leadely dashboard reference while preserving the current Mantine stack and real application data.

Do not change database schema, auth, billing, routes, business logic, API contracts, or V2 architecture in this task.

## What is wrong in the current dashboard

The current dashboard is functionally usable but visually closer to an admin panel than the approved CRM/BD workspace.

Main differences:
- Header is too empty: greeting on the left and only `New quote` on the right.
- KPI cards are visually loose and lack supporting context/trend treatment.
- `Quote pipeline` is a simple status list rather than a visual pipeline.
- `AI Brief` looks like a promo box instead of an interactive assistant.
- There is no `Today's Tasks` panel.
- The lower half is dominated by a large Recent Quotes empty state and a low-value Workspace card.
- There is no Recent Leads table, forecast chart, Top Companies panel, or bottom Leadely banner.
- Sidebar group styling is visually noisy; `ENGAGE` currently looks selected.
- Empty states create too much unused space.

## Desktop shell

Target viewport: 1440–1536px desktop.

- Mantine `AppShell`
- Navbar width: 220px
- Main padding: 28px horizontal, 20–24px vertical
- Grid gap: 14–16px
- Main canvas: #F8FAFB or equivalent light neutral
- Cards: white surface, 1px #E7EBF0 border, 12px radius, subtle/no shadow

## Dashboard layout

Use a consistent 12-column grid.

### Row 1
Four equal KPI cards: 3 / 3 / 3 / 3

### Row 2
- Pipeline Overview: span 5
- AI Assistant: span 4
- Today's Tasks: span 3

### Row 3
- Recent Leads: span 5
- Deal Forecast: span 4
- Top Companies: span 3

### Row 4
- Leadely banner: span 12

## Header

Left:
- Greeting
- One-line contextual subtitle

Right:
- Search field 320–360px
- Notification `ActionIcon`
- Primary `+ New` or current working `+ New quote` action

Search:
- 40px height
- 10px radius
- subtle neutral background
- search icon left
- low-emphasis placeholder

Primary button:
- 40px height
- 9–10px radius
- dark emerald
- white text

## Typography

Use the current project typography configuration.

Recommended hierarchy:
- Page greeting: 27–30px, 700–750
- Subtitle: 14–15px, regular, muted slate
- Panel title: 15–16px, 650–700
- Metric label: 12.5–13.5px, medium
- Metric number: 25–28px, 700
- Table headers: 11.5–12px
- Table body: 12–13px

Do not make everything bold.

## Leadely color usage

Use green as an accent, not as the whole interface.

Suggested tokens:
- leadely-950: #063E33
- leadely-900: #075E4A
- leadely-800: #08775A
- leadely-700: #078A65
- leadely-600: #0B9F73
- leadely-500: #10B981
- leadely-400: #34D399
- leadely-300: #6EE7B7
- leadely-200: #A7F3D0
- leadely-100: #D1FAE5
- leadely-50: #ECFDF5
- ink-950: #07111F
- ink-800: #182235
- ink-600: #526078
- ink-500: #748098
- line: #E7EBF0
- canvas: #F8FAFB

Target ratio:
- 85% neutral/white
- 10% Leadely green
- 5% semantic colors

## KPI cards

Create/reuse a `MetricCard`.

Structure:
- 38–42px pale-mint icon block
- small muted label
- large value
- optional real trend/context
- left aligned

Card height: 96–104px.

Preferred metrics when available:
1. Total Leads
2. Active Deals
3. Tasks or Meetings Today
4. Pipeline Value

Never hard-code the reference screenshot numbers. Use real repository data.

If a metric is not implemented yet, use the closest existing real metric while preserving the visual structure.

## Pipeline Overview

Replace the current horizontal Quote Pipeline rows with a visual pipeline panel.

Header:
`Pipeline Overview` + compact period selector.

Content:
- vertical bars by stage
- count/value above bars
- small muted stage label below
- progressively deeper green shades
- soft 6px top radius
- no heavy axes or chart chrome

Use Deal stages when available.
If only quote statuses exist, temporarily map Draft / Sent / Won / Lost into this visual structure.

Do not collapse the panel when data is empty.

## AI Assistant

Transform the existing `AI Brief` card into a signature AI Assistant panel.

Structure:
- AI/star icon
- `AI Assistant`
- small BETA badge
- short contextual greeting
- 3–4 quick action rows
- ask input at bottom

Example actions:
- Find new leads
- Draft a follow-up email
- Summarize a company
- Prepare for a meeting

Only enable actions that truly exist. Omit or disable unimplemented actions instead of faking functionality.

Visual:
- pale mint gradient
- slightly greener border than standard cards
- white quick action rows
- dark emerald send button

## Today's Tasks

Add a dedicated tasks panel.

Rows:
- checkbox
- task title
- due time
- compact type/action icon

If empty:
- preserve card height
- centered compact empty state
- do not remove the panel

## Recent Leads

Use a compact CRM table.

Columns:
Name / Company / Source / Status / Last Activity / Menu

Rows:
- avatar
- primary name + secondary email
- company icon/logo
- status badge
- muted activity timestamp
- overflow menu

If Leads are not yet available, use Recent Quotes or Recent Activity temporarily but apply this same table visual language.

Do not keep the current oversized Recent Quotes empty card.

## Deal Forecast

Use existing weighted forecast/deal data.

Panel:
- title + period selector
- large projected value
- short context label
- compact legend
- subtle line/area chart

Use Mantine Charts only if already installed. Otherwise reuse the chart package already in the repo. Do not introduce another chart library without need.

If no data exists, show a zero-value forecast with a subtle empty chart state.

## Top Companies

Show five compact rows ranked by:
1. active deals count, or
2. total pipeline value

Each row:
- logo/icon
- company name
- count/value
- chevron

If unavailable, show a polished empty state.

## Bottom Leadely banner

Add a full-width branded visual anchor.

Headline:
`Turn conversations into opportunities`

Supporting text:
`Let AI handle the busy work, so you can focus on what matters — building relationships.`

Use only buttons that map to real routes/actions.

Visual:
- 100–115px high
- subtle mint/emerald abstract geometry
- headline and actions on left
- decorative visual toward right
- no stock illustration
- this is the only dashboard surface allowed to be more expressive

## Sidebar

Do not change route architecture.

Refine the current sidebar:
- width 220px
- use actual Leadely logo/wordmark asset, not placeholder `L`
- nav item height ~40px
- radius 9px
- icons 17–18px
- labels 13–14px
- active row = pale mint
- active text/icon = dark emerald

Group labels:
- keep FIND / CRM / SELL / ENGAGE / WORKSPACE if needed
- 10–11px uppercase
- muted slate
- letter spacing
- more top margin than bottom margin
- no group label should look selected
- specifically remove the highlighted-box appearance currently visible on `ENGAGE`

Bottom user section:
- avatar
- user name
- email/role
- menu chevron

If architecture allows, move Sign out into the user menu.

## Current → target mapping

- Greeting → keep, refine typography/spacing
- New Quote button → keep, move into command header
- Open deals KPI → MetricCard
- Companies KPI → MetricCard
- Weighted forecast KPI → MetricCard
- Pipeline value KPI → MetricCard
- Quote pipeline → PipelineOverview chart
- AI Brief → AI Assistant panel
- Recent quotes → Recent Leads/Recent Activity table visual
- Workspace card → remove from primary dashboard
- Workspace quota → move to Billing/account/compact usage area
- Empty lower space → Forecast + Top Companies + Leadely banner
- No Tasks → add Today’s Tasks
- No Search → add command search
- No Notifications → add notification ActionIcon

## Empty-state rule

The page must still look polished when the database contains zero data.

Bad:
- giant blank card
- oversized empty-state icon
- huge CTA

Preferred:
- preserve the target grid
- preserve panel height
- muted small icon
- one short sentence
- optional small CTA
- never let an empty panel become much taller than adjacent panels

## Mantine implementation

Use Mantine primitives first:
- AppShell
- Grid
- SimpleGrid
- Paper
- Stack
- Group
- Box
- Text
- Title
- ThemeIcon
- Badge
- Button
- ActionIcon
- TextInput
- Select
- Table
- Checkbox
- Menu
- Avatar
- Divider
- Skeleton

Custom Leadely components:
- DashboardHeader
- MetricCard
- DashboardPanel
- PipelineOverview
- AiAssistantPanel
- TodayTasksPanel
- RecentLeadsPanel
- DealForecastPanel
- TopCompaniesPanel
- LeadelyBanner

Do not rebuild Mantine primitives with custom HTML.

## Suggested component tree

DashboardPage
- DashboardHeader
  - Greeting
  - DashboardActions
    - GlobalSearch
    - Notifications
    - CreateAction
- SimpleGrid (4 cols)
  - MetricCard x4
- Grid
  - PipelineOverview
  - AiAssistantPanel
  - TodayTasksPanel
- Grid
  - RecentLeadsPanel
  - DealForecastPanel
  - TopCompaniesPanel
- LeadelyBanner

## QA target

Inspect at:
- 1440 × 900
- 1536 × 960

Verify:
- no horizontal scrolling
- no oversized whitespace
- cards align vertically per row
- no inconsistent card heights
- sidebar fixed and visually calm
- dashboard fits naturally in about 1.1–1.3 viewport heights
- data tables remain compact
- page reads as one coherent workspace

## Do not do

- Do not change backend architecture.
- Do not change V2 schema.
- Do not create fake CRM data.
- Do not hard-code screenshot values.
- Do not implement mobile layouts.
- Do not redesign Quote Editor here.
- Do not alter auth or permissions.
- Do not add glassmorphism.
- Do not add heavy animation.
- Do not add strong gradients to normal cards.
- Do not use oversized 20–24px radii.
- Do not replace Mantine with a different design system.
- Do not stop after only changing colors.

# Cursor execution prompt

Inspect the current Leadely repository before coding, especially:
- dashboard page
- AppShell/navbar
- Mantine theme
- dashboard components
- V2 data hooks/actions
- chart packages
- Leadely logo assets

Then redesign ONLY the desktop dashboard to reproduce the approved reference's:
- information hierarchy
- 12-column grid
- card density
- spacing
- typography
- surface treatment
- AI panel treatment
- CRM workspace feel

Use real data from the repository. If a data source does not exist, keep the visual slot with a graceful empty state instead of inventing values.

Do not change database schema, migrations, auth, billing, routes, permissions, quote business logic, APIs, or V2 architecture.

After implementation:
1. run typecheck
2. run lint
3. run build if practical
4. inspect at 1440px and 1536px
5. fix overflow/alignment/card-height issues

The redesign is successful only when the dashboard visually resembles the approved Leadely reference at first glance—not merely when colors are similar.
