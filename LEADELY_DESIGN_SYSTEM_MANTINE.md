# LEADELY — Desktop Product Design System (Mantine)

> **Purpose:** Visual/UI refactor specification for the current Leadely codebase **before** expanding the CRM/BD architecture.
>
> **North-star reference:** the approved Leadely desktop dashboard concept generated in this project. Treat that screen as the visual target, **not** as a feature specification.
>
> **Phase constraint:** this document is for **desktop web only**. Do not design or implement mobile app layouts in this phase.

---

## 0. Cursor: read this first

This is a **visual refactor**, not a product-architecture refactor.

### Hard rules

1. **Do not change database schema, RLS, API contracts, route structure, server actions, billing logic, auth rules, or quote calculations.**
2. **Do not add the future CRM architecture yet** (Deals, Activities, Inbox, Sequences, Relationship Map, etc.). Those will be a separate phase.
3. Keep all currently shipped workflows functional: auth, workspace, quote wizard, AI Brief, clients, modules, settings, team, billing, platform portal, sharing and exports.
4. Do not invent UI actions that the backend does not currently support. Example: if delete-client is not implemented, do not add a working-looking Delete button.
5. Refactor the UI from the outside in: **tokens → shell → primitives → page patterns → individual routes**.
6. Prefer reusable components over route-specific styling.
7. Keep the interface quiet. Green is an **accent**, not a background flood.
8. Use one dominant visual hierarchy per screen. Avoid “dashboard card soup.”
9. **Frontend is Mantine-first.** Keep the current Next.js + React + Mantine + Lucide stack. Do not rebuild Mantine primitives with Tailwind-style utility classes or introduce another UI framework.
10. Use Mantine theme tokens, component extensions, Styles API, CSS Modules and CSS variables as the primary styling architecture. Local `style` props are allowed only for genuinely one-off values; do not build the design system through scattered inline styles.
11. After each route is restyled, validate desktop at **1440px**, **1280px**, and **1024px** widths.


### Reference asset

Place the approved dashboard screenshot in the repo as:

`/docs/references/leadely-dashboard-reference.png`

Cursor should visually compare the implementation against it throughout the refactor.

### Current frontend implementation assumption

The previous MASTER.md snapshot described Tailwind as the UI layer, but the frontend has now been migrated to **Mantine**. For this visual-refactor phase, treat the actual repository implementation as the source of truth for installed Mantine packages/version. Do not reintroduce Tailwind as the primary component-styling system.

Use this responsibility split:

- **Mantine Core** → AppShell, Paper, Card, Group, Stack, Grid/SimpleGrid, Button, ActionIcon, Input, TextInput, Textarea, Select, Combobox, Badge, Tabs, Table, ScrollArea, Menu, Popover, Tooltip, Modal, Drawer, Skeleton, Alert.
- **Mantine hooks/forms/notifications** → use only if they already exist or are needed by an existing workflow; do not add product features during the visual refactor.
- **Lucide React** → product icon set unless an existing Mantine-specific icon implementation already standardizes icons.
- **CSS Modules / Styles API** → component-specific visual tuning that cannot be expressed cleanly through theme/default props.
- **Leadely theme** → colors, radius, typography, focus, shadows and global Mantine component defaults.

---

# 1. Design direction

## 1.1 One-line definition

**Quiet, premium, AI-native business software with human warmth.**

Leadely should feel like a modern workspace for serious BD/Sales work: clean enough to process dense data, soft enough to feel approachable, and intelligent without looking futuristic for the sake of it.

## 1.2 Visual DNA

The approved dashboard is defined by:

- warm off-white application canvas;
- pure-white information surfaces;
- thin cool-gray borders;
- very soft shadows, used sparingly;
- deep navy/near-black typography;
- emerald → mint → teal accents;
- generous whitespace;
- rounded but **not bubbly** components;
- thin Lucide-style icons;
- charts that use green as the data story rather than decoration;
- AI surfaces distinguished by a subtle mint wash instead of a separate “chatbot theme.”

### Keywords

`calm` · `precise` · `human` · `productive` · `premium SaaS` · `AI-native` · `relationship-led`

### Avoid

- heavy glassmorphism;
- neon cyberpunk AI styling;
- large gradients behind ordinary cards;
- excessive shadows;
- pill-shaped everything;
- huge typography inside operational pages;
- thick borders;
- overly colorful status systems;
- large illustrations in core workflows;
- full-black sidebar;
- purple-as-default “AI” styling;
- crowded admin-dashboard visual language.

---

# 2. Research-derived product UI principles

The visual system should support the behavior of a sales workspace, not just look modern.

### 2.1 Action before reporting

The dashboard should help a user understand **what needs attention now**, then provide context and metrics. KPI cards are compact; tasks, recent work and AI guidance receive more visual weight.

### 2.2 AI should feel embedded, not bolted on

AI panels use the same UI primitives as the rest of Leadely. Do not create a totally separate purple chatbot experience. AI can have a mint-tinted surface and sparkle icon, but its buttons, inputs and typography must stay within the core system.

### 2.3 Product concepts must look consistent everywhere

A quote, client, user, module, invoice and plan should each have one consistent visual representation across tables, detail screens, selectors, dialogs and dashboards. The design system is not only a button library; it is a shared language for Leadely objects.

### 2.4 Dense information, low visual noise

BD/Sales users spend long periods in tables, forms and histories. Optimize scanning through alignment, spacing, typography and hierarchy instead of adding more decoration.

---

# 3. Foundation tokens

## 3.1 Color system

Use semantic names in code. Avoid hard-coded color values inside page components.

### Brand / green

| Token | Value | Use |
|---|---:|---|
| `brand-900` | `#064E3B` | rare dark brand surfaces |
| `brand-800` | `#065F46` | primary hover / pressed |
| `brand-700` | `#047857` | primary CTA |
| `brand-600` | `#059669` | charts, emphasis |
| `brand-500` | `#10B981` | core Leadely green |
| `brand-400` | `#34D399` | secondary gradient / positive accent |
| `brand-300` | `#6EE7B7` | soft chart areas |
| `brand-200` | `#A7F3D0` | selection accents |
| `brand-100` | `#D1FAE5` | green tint |
| `brand-50` | `#ECFDF5` | active rows / AI wash |

### Teal support

| Token | Value | Use |
|---|---:|---|
| `teal-600` | `#0D9488` | chart secondary |
| `teal-500` | `#14B8A6` | gradient endpoint |
| `teal-100` | `#CCFBF1` | soft teal tint |

### Neutral system

| Token | Value | Use |
|---|---:|---|
| `ink-950` | `#07111F` | strongest text / branded dark |
| `ink-900` | `#0F172A` | primary text |
| `ink-700` | `#334155` | secondary text/icons |
| `ink-600` | `#475569` | body muted |
| `ink-500` | `#64748B` | captions |
| `ink-400` | `#94A3B8` | placeholders / metadata |
| `line-300` | `#CBD5E1` | strong border / controls |
| `line-200` | `#E2E8F0` | default border |
| `line-100` | `#EEF2F6` | dividers / table lines |
| `canvas` | `#F8FAFA` | app background |
| `surface-subtle` | `#F7FAF9` | quiet nested surface |
| `surface` | `#FFFFFF` | cards / panels |

### Feedback colors

Use these only when semantics require them.

| Semantic | Main | Soft bg | Text |
|---|---|---|---|
| Success | `#10B981` | `#ECFDF5` | `#047857` |
| Info | `#3B82F6` | `#EFF6FF` | `#1D4ED8` |
| Warning | `#F59E0B` | `#FFFBEB` | `#B45309` |
| Danger | `#EF4444` | `#FEF2F2` | `#B91C1C` |
| Violet/status | `#8B5CF6` | `#F5F3FF` | `#6D28D9` |

### Brand gradients

Use gradients only for brand moments, chart areas, AI highlights and promotional banners.

```css
--gradient-brand: linear-gradient(135deg, #059669 0%, #10B981 45%, #14B8A6 100%);
--gradient-brand-soft: linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%);
--gradient-ai: linear-gradient(135deg, rgba(236,253,245,.78) 0%, rgba(240,253,250,.92) 100%);
--gradient-dark-brand: linear-gradient(135deg, #073B32 0%, #065F46 50%, #0F766E 100%);
```

**Rule:** ordinary dashboard cards remain white. Do not apply gradients to every card.

---

# 4. Typography

## 4.1 Product UI font

Use **Geist** for application UI because it already exists in the current codebase and matches the approved dashboard’s compact modern SaaS feel.

The custom Leadely wordmark is a **brand asset**, not a UI font. Do not attempt to reproduce the logo wordmark with CSS text.

## 4.2 Type scale

| Style | Size / line | Weight | Typical use |
|---|---|---:|---|
| Display | `32/38` | 700 | rare empty states / onboarding |
| Page title | `26/32` | 700 | page heading |
| Page subtitle | `14/21` | 400 | heading support |
| Section title | `16/22` | 650–700 | card title / section title |
| Metric XL | `30/34` | 700 | top KPI value |
| Metric | `22/28` | 700 | secondary metrics |
| Body | `14/20` | 400 | forms / text |
| Body strong | `14/20` | 600 | labels / row titles |
| Small | `12/18` | 400–500 | metadata |
| Label | `11/16` | 600 | uppercase or compact labels |
| Micro | `10/14` | 500 | table support only |

### Typography rules

- Page titles use `ink-900`.
- Main values use `ink-950` or `ink-900`.
- Supporting text uses `ink-500/600`.
- Do not use letter spacing on normal body text.
- Uppercase labels may use `0.08em` tracking.
- Never use more than 3 font weights on one screen.
- Prefer sentence case over Title Case for buttons and labels.

---

# 5. Spacing and geometry

## 5.1 Base spacing scale

Use a 4px base.

`4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64`

Most UI should be built from `8 / 12 / 16 / 24 / 32`.

## 5.2 Radius

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | `8px` | badges / compact controls |
| `radius-md` | `10px` | buttons / inputs |
| `radius-lg` | `12px` | rows / nested cards |
| `radius-xl` | `14px` | main dashboard panels |
| `radius-2xl` | `18px` | promotional / hero surfaces only |

Avoid 24–32px radius in productivity UI.

## 5.3 Borders

Default:

```css
border: 1px solid #E2E8F0;
```

Nested rows can use `#EEF2F6`.

Focus:

```css
border-color: #10B981;
box-shadow: 0 0 0 3px rgba(16, 185, 129, .12);
```

## 5.4 Shadows

The approved UI is primarily **border-defined**, not shadow-defined.

```css
--shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.03);
--shadow-sm: 0 4px 14px rgba(15, 23, 42, 0.04);
--shadow-float: 0 12px 32px rgba(15, 23, 42, 0.08);
```

Use:

- cards: `shadow-xs` or none;
- dropdown/popover: `shadow-float`;
- modal: `shadow-float`;
- sidebar: no heavy shadow; use right border.

---

# 6. Desktop application shell

## 6.1 Supported widths

Desktop phase only:

- **Primary design target:** 1440–1536px viewport.
- Comfortable: `>= 1280px`.
- Minimum desktop: `1024px`.
- `<1024px`: out of scope for this phase; do not build mobile navigation yet.

## 6.2 Sidebar

Reference proportions:

- width: `224px` at `>=1440`;
- width: `216px` at `1280–1439`;
- width: `200px` at `1024–1279`;
- fixed left, full height;
- `surface` background;
- `1px` right border `line-100/200`;
- internal padding: `16px` horizontal.

### Sidebar anatomy

1. Brand area: 68–76px high.
2. Main navigation.
3. Flexible spacer.
4. Utility navigation (`Integrations`, `Settings`).
5. Account footer.

### Navigation item

- height: `42px`;
- horizontal padding: `12px`;
- icon: `18px`;
- gap icon/text: `12px`;
- radius: `9–10px`;
- text: `13px / 600` active, `13px / 500` inactive.

Inactive:

```text
bg: transparent
icon/text: #475569
```

Active:

```text
bg: #ECFDF5
icon: #059669
text: #047857
```

Hover inactive:

```text
bg: #F7FAF9
text: #0F172A
```

Do not use a large filled green sidebar.

## 6.3 Main content

```text
main left = sidebar width
page padding X = 28px @ 1440+
page padding X = 24px @ 1280
page padding X = 20px @ 1024
page padding bottom = 32px
```

Set an internal max width only where a long form needs it. Dashboard and data tables should use the available width.

## 6.4 Top utility row

The dashboard reference uses a lightweight utility row rather than a large app header.

Right-aligned cluster:

- global search: 300–340px;
- notification icon button: 38–40px;
- `+ New` primary button: 104–116px.

Search height: `40px`.

Use `surface-subtle` background rather than a heavy bordered input.

---

# 7. Grid system

## 7.1 Page grid

Use CSS grid with 12 conceptual columns for complex dashboard screens.

```css
grid-template-columns: repeat(12, minmax(0, 1fr));
gap: 14px;
```

At 1280+, typical dashboard:

- KPI cards: `3 columns each` × 4.
- large primary panel: `5 columns`.
- AI panel: `3 columns`.
- task panel: `4 columns`.
- lower table: `6 columns`.
- chart: `4 columns`.
- ranked list: `2 columns`.

Do not force exactly these spans on every page. Preserve the visual rhythm: **one large anchor + one/two support panels**.

## 7.2 Vertical rhythm

- page header → KPIs: `24px`;
- panel row gaps: `14–16px`;
- section gaps: `20–24px`;
- internal card padding: `16–18px` compact, `20px` normal.

---

# 8. Core component specifications

## 8.1 Page header

Structure:

```text
Title                            optional right action
Subtitle / context
```

Dashboard may include a small brand quote/tagline aligned top-right.

- title: `26/32 700`;
- subtitle: `14/21`, `ink-500`;
- margin bottom: `24px`.

Do not put every action in the page header. Keep one primary action maximum.

---

## 8.2 KPI / metric card

Use for 3–4 top-level metrics only.

```text
[soft icon]  Label
             1,248    ↑12%
                      vs last month
```

Specs:

- min height: `96px`;
- padding: `16px`;
- radius: `12px`;
- border: `line-200`;
- background: white;
- icon container: `38×38`, radius `50%` or `10px`, soft semantic background;
- metric: `24–30px`, 700;
- delta: `12px`, 600;
- comparison text: `11px`, `ink-400`.

Only positive metrics use green. Negative changes should use semantic danger/warning when actually meaningful.

---

## 8.3 Standard panel

Reusable `Panel` component:

```tsx
<Panel
  title="Recent quotes"
  action={<Button variant="ghost">View all</Button>}
>
  ...
</Panel>
```

Specs:

- white background;
- 1px border;
- 14px radius;
- no decorative gradient;
- heading row 44–48px visual height;
- content padding `16–18px`.

---

## 8.4 AI panel

This is a signature Leadely component.

Visual:

```css
background: linear-gradient(135deg, rgba(236,253,245,.86), rgba(240,253,250,.96));
border-color: rgba(16,185,129,.15);
```

Header:

- sparkle/star icon in `brand-500`;
- `AI Assistant` or context-specific AI title;
- optional `BETA` mini badge;
- overflow menu aligned right.

Quick action rows:

- white/80% surface;
- 36–40px height;
- `8px` radius;
- 1px translucent green/neutral border;
- left icon `16px` brand green;
- chevron right subtle.

Input footer:

- white background;
- 38–40px height;
- dark-green circular/rounded send action.

**Important:** AI panel should never dominate more than ~30–35% of a standard workspace screen unless the user explicitly opens the AI Assistant page.

---

## 8.5 Buttons

### Primary

```text
bg #047857
hover #065F46
text white
height 40px
padding 14–16px
radius 10px
```

Use only for primary actions such as `New quote`, `Save`, `Send quote`, `Pay now`.

### Secondary

```text
bg white
border #CBD5E1
text #334155
hover bg #F8FAFA
```

### Soft / brand

```text
bg #ECFDF5
text #047857
hover #D1FAE5
```

### Ghost

No border/background by default; text `ink-600`; hover `surface-subtle`.

### Destructive

Never style a destructive action as the main green CTA.

### Button sizing

- default `40px`;
- compact `34px`;
- icon-only `36–40px`.

Avoid fully pill-shaped buttons except compact filters/status chips.

---

## 8.6 Inputs / selects / search

Default control:

- height: `40px`;
- radius: `10px`;
- border `#E2E8F0`;
- background white;
- font `14px`;
- placeholder `#94A3B8`.

Focus uses green ring token.

Large textareas: `12px` radius, padding `12–14px`.

Search fields may use `#F7FAF9` background and no visible border until focus.

---

## 8.7 Tables

Tables should feel more like structured lists than spreadsheets.

### Container

- white panel;
- 1px outer border;
- 12–14px radius;
- overflow hidden.

### Header

- height `36–40px`;
- labels `11px / 600`, `ink-500`;
- no heavy filled gray bar;
- optional subtle `#FAFBFB` background.

### Row

- min height: `48–52px`;
- border bottom `line-100`;
- primary text `13px / 500–600`;
- metadata `11–12px`;
- hover `#F8FCFA`.

### Identity cell

For clients/users:

```text
[avatar/logo 28–32]
Primary name
Secondary email/company
```

### Row actions

Use kebab/ellipsis. Do not expose 4 icon buttons in every row.

---

## 8.8 Status badges

Status badges are compact signals, not buttons.

- height: `22–24px`;
- radius: `6–7px`;
- padding: `6–8px` horizontal;
- type: `11px / 600`.

Current quote status mapping:

| Quote status | Styling |
|---|---|
| Draft | neutral gray |
| Sent | soft blue |
| Won | soft green |
| Lost | soft red |

Do not introduce pipeline statuses from the future Deal architecture during this phase.

---

## 8.9 Tabs

Use tabs for sibling views, not main navigation.

Preferred style:

- no boxed tab container;
- text tabs with 2px active underline, or compact segmented control for 2–3 modes;
- 36–40px height;
- active text `ink-900` or brand green.

---

## 8.10 Dropdowns / popovers

- white surface;
- `10–12px` radius;
- `line-200` border;
- `shadow-float`;
- padding `6px`;
- item height `34–38px`;
- destructive item separated and red text.

---

## 8.11 Modal / dialog

- overlay: `rgba(7,17,31,.32)`;
- width small `420px`, normal `560px`, complex `720px`;
- radius `14–16px`;
- white surface;
- header 20–24px padding;
- footer subtle top border;
- do not overuse modals for full workflows.

---

## 8.12 Drawer / side panel

Use for contextual editing when staying on a list is valuable.

- width `420–520px`;
- white;
- left border;
- soft shadow;
- full viewport height.

Do not convert the 4-step quote creation flow into a drawer.

---

## 8.13 Empty states

Compact productivity empty state:

```text
[40px soft icon]
No quotes yet
Create your first quote or generate one from an AI brief.
[Create quote]
```

Do not use giant illustrations.

---

## 8.14 Loading states

Use skeletons matching the exact final geometry.

- no full-page spinner for ordinary data refresh;
- buttons may show inline spinner while submitting;
- skeleton background `#EEF2F6` with subtle motion.

---

## 8.15 Toasts

- bottom-right desktop;
- max width `360px`;
- white surface + border + shadow;
- semantic icon;
- 4–5 second default duration;
- persistent for destructive/error states when user action is required.

---

# 9. Icon system

Use **Lucide React** consistently.

### Sizes

- sidebar: `18px`;
- normal controls: `16px`;
- compact: `14px`;
- card feature icon: `18–20px`.

### Stroke

Use default thin/medium Lucide stroke. Do not mix with filled icon families.

### Icon containers

Feature/KPI icons can sit in a soft 36–40px container.

Do not put every icon in a colored circle.

---

# 10. Chart language

Charts should carry the Leadely identity without becoming decorative.

## 10.1 General rules

- green/teal first;
- maximum 4 data colors in ordinary charts;
- grid lines: `#EEF2F6`, thin;
- axes labels: `11px`, `ink-500`;
- tooltip: white, border, `10px` radius, soft shadow;
- no 3D charts;
- no rainbow categorical palette when semantic grouping is possible.

## 10.2 Area/line chart

Primary line:

```text
stroke: #059669
stroke width: 2.5–3px
```

Area:

```css
linear-gradient(to bottom, rgba(16,185,129,.28), rgba(16,185,129,.02))
```

## 10.3 Funnel/bar chart

Use progression from lighter mint to darker emerald where the order itself matters.

Example quote workflow for current product:

`Draft → Sent → Won / Lost`

Do not add future Deal stages until that architecture exists.

---

# 11. Motion and interaction

Motion should communicate responsiveness, not entertainment.

### Timing

- hover: `120–160ms`;
- menus/popovers: `140–180ms`;
- dialog/drawer: `180–220ms`;
- route/content transition: generally avoid custom animation.

### Easing

`cubic-bezier(0.2, 0, 0, 1)` or equivalent ease-out.

### Hover language

Use one of:

- background tint;
- border color change;
- 1–2px visual lift **only for marketing/promotional cards**.

Do not make every dashboard card float on hover.

### Reduced motion

Respect `prefers-reduced-motion`.

---

# 12. Accessibility baseline

- Minimum body text: 12px only for metadata; normal content 14px.
- Minimum hit target: 36px desktop; 40px preferred for primary controls.
- Visible keyboard focus ring.
- Never communicate status using color alone.
- All icon-only controls require accessible labels/tooltips.
- Form errors should appear directly below their field.
- Preserve a logical tab order.
- Charts need textual labels/summaries for essential values.

---

# 13. Current-route page templates

These templates deliberately use **current capabilities only**. Future Lead/Deal/Sequence architecture is not part of this phase.

## 13.1 `/app` — Dashboard

Use the approved dashboard as the visual north star, but map it to existing data.

### Recommended composition

**Header**

```text
Good afternoon, {name}
Here’s what’s happening with your business development today.
```

**Top KPI row — 4 cards**

1. Total quotes
2. Clients
3. Sent quotes
4. Quote pipeline value (`sent + won`) or won value if that is more reliable in the current query

Do not show fake Leads, Active Deals, Meetings or CRM metrics before those objects exist.

**Main row**

- 6–7 columns: Quote status overview / quote pipeline visualization.
- 5–6 columns: AI Brief / AI Assistant quick-start panel.

**Lower row**

- 7–8 columns: Recent quotes table.
- 4–5 columns: Usage / workspace summary / recent clients / plan usage — choose only data already available.

Optional bottom brand banner can be retained, but never place it above operational information.

---

## 13.2 Quote list (if list route exists / wherever quotes are listed)

Page header:

```text
Quotes
Create, review and share client proposals.
                         [New quote]
```

Controls row:

`Search` + `Status filter` + `Client filter` + optional `Sort`.

Main table:

- Quote / public ID
- Client
- Status
- Value
- Valid until
- Updated
- owner if currently available
- row action

Use compact badges and aligned numeric columns.

---

## 13.3 `/app/quotes/new` and `/app/quotes/[id]` — Quote editor

This is a flagship workflow and should receive more attention than the dashboard.

### Desktop composition

Top:

```text
Back to quotes
Quote title                                   Save status / actions
Step 1 ─ Step 2 ─ Step 3 ─ Step 4
```

Body on `>=1280`:

```text
┌──────────────────────────────────────┬────────────────────┐
│ Main step content (8 cols)           │ Sticky summary     │
│                                      │ (4 cols)           │
└──────────────────────────────────────┴────────────────────┘
```

At 1024–1279, summary may sit below the main content rather than squeezing forms.

### Step visual language

**Step 1 — Brief & client**

- client selector as clean combobox;
- AI Brief = signature mint panel;
- requirements textarea large and calm;
- generated result shown in structured sections, not raw JSON-looking blocks.

**Step 2 — Catalog & line items**

- module catalog inside white panel with search/filter;
- selected line items in table;
- money aligned right;
- custom item button = secondary, not primary.

**Step 3 — Timeline & payment**

- group fields into `Commercial`, `Timeline`, `Payment`, `Warranty` cards;
- avoid one very long undifferentiated form.

**Step 4 — Preview & export**

- preview is the visual anchor;
- share/export actions grouped by intent;
- primary action should be `Mark sent` / equivalent current workflow, not all export formats competing as green buttons.

### Sticky summary

Show only context that aids decisions:

- client;
- subtotal;
- discount;
- VAT;
- grand total;
- valid-until;
- quote status.

Do not make the summary visually heavier than the editor.

---

## 13.4 `/app/clients`

Current product uses clients as a combined company/contact record. Keep that model in Phase 1.

Layout:

- title + subtitle + `Add client`;
- search;
- table or highly structured list;
- company logo/avatar;
- company name;
- contact;
- email / phone;
- industry;
- latest relevant metadata if currently queryable.

Do not visually pretend Companies and Contacts are separate objects yet.

---

## 13.5 `/app/modules`

Use a two-level hierarchy:

1. category filtering / search;
2. catalog list/cards.

Recommended visual:

- category chips are compact and neutral;
- modules are white list/cards with name, description/category and suggested price;
- `Add module` primary/secondary based on role;
- members see the same clean read-only layout without fake edit affordances.

---

## 13.6 `/app/settings`

Settings should be a calm form workspace, not a dashboard.

On wide desktop:

```text
Settings sub-navigation (220px) | Form content (max 760px)
```

Suggested sections based on current data:

- Workspace / company
- Branding
- Quote defaults
- Legal & contract
- Banking
- Data import / workspace conversion where applicable

Each section uses a page-level heading + one or two white form cards.

Do not show all settings in one massive card.

---

## 13.7 `/app/team`

- page header + Invite member;
- seat usage small inline indicator;
- member table;
- role badge;
- invitation state if available;
- workspace-role permissions reflected in button visibility.

---

## 13.8 `/app/billing`

Billing should preserve the product’s calm visual style and avoid “pricing landing page” aesthetics inside the app.

Structure:

1. Current plan summary
2. Usage meters
3. Plan options
4. Checkout/payment state
5. Invoice/payment history

Plan card:

- subtle border;
- current plan gets green border/tint;
- no giant marketing gradients;
- price remains prominent but compact.

VietQR / payment panel may use a centered QR, clear payment amount/code and status chip.

---

## 13.9 Platform admin

Reuse exactly the same design system.

Do not create a second “admin theme.”

Differentiate platform context via:

- `Platform` label next to Leadely mark;
- platform-specific sidebar items;
- optional neutral/slate active accent for dangerous operations, while primary interaction remains Leadely green.

Tables for workspaces/payments/plans should prioritize density and clarity.

---

# 14. Brand usage inside the product

## 14.1 Logo

Use exported brand assets for:

- horizontal lockup in sidebar;
- mark-only icon in favicon/app icon contexts;
- monochrome version when necessary.

Do not recreate the Leadely mark with CSS shapes.

## 14.2 Tagline

`YOUR AI BD ASSISTANT`

Use sparingly:

- sidebar brand lockup when space allows;
- onboarding / auth;
- branded empty states;
- not repeated on every product page.

## 14.3 Brand statements

Approved tone examples:

- `More conversations. More opportunities.`
- `Turn conversations into opportunities.`
- `Find. Engage. Automate. Grow.`

Treat these as brand accents, not navigation labels.

---

# 15. Mantine component architecture

Do not create a parallel custom UI kit for primitives that Mantine already solves well. The Leadely layer should be **thin and semantic**.

## 15.1 Prefer Mantine primitives directly

| Leadely need | Mantine base | Leadely treatment |
|---|---|---|
| App frame | `AppShell` | custom navbar/header layout and CSS module |
| Standard panel | `Paper` | `withBorder`, `radius="lg"`, quiet shadow |
| KPI card | `Paper` + `Group` + `ThemeIcon` | custom `MetricCard` composition |
| Page layout | `Stack`, `Group`, `Grid`, `SimpleGrid` | consistent gaps from theme |
| Primary action | `Button` | theme default + Leadely variants |
| Icon action | `ActionIcon` | subtle/transparent variants |
| Inputs | `TextInput`, `Textarea`, `Select`, `NumberInput`, `DateInput` where already available | shared sizes/radius through theme |
| Status | `Badge` | semantic color map |
| Navigation | `NavLink` or composed `UnstyledButton` | custom sidebar visual state |
| Data list | `Table` + `ScrollArea` | quiet dividers, sticky header only where useful |
| Menu | `Menu` | row actions / overflow |
| Filters | `Popover`, `Menu`, `Select` | compact controls |
| Dialog | `Modal` | confirmation/small edit tasks |
| Side detail | `Drawer` | contextual detail only |
| Tabs | `Tabs` | underline/subtle variant |
| Loading | `Skeleton`, `Loader` | preserve layout geometry |
| Feedback | `Alert` / notifications system | semantic feedback |
| AI treatment | `Paper` + custom module class | mint wash, same core controls |

## 15.2 Leadely-specific components

Only create wrappers for repeated **product compositions**, not generic primitives:

```text
src/components/leadely/
  metric-card.tsx
  section-panel.tsx
  page-header.tsx
  status-badge.tsx
  entity-row.tsx
  ai-panel.tsx
  empty-state.tsx
  quote-summary.tsx
  app-logo.tsx

src/components/layout/
  leadely-shell.tsx
  leadely-navbar.tsx
  top-utility-bar.tsx
  content-container.tsx
```

If the project already has equivalent components, refactor them rather than duplicating.

### Avoid

Do not create `button.tsx`, `input.tsx`, `select.tsx`, `modal.tsx`, etc. solely to wrap Mantine one-to-one. Configure Mantine globally and use the primitives directly unless a wrapper adds real Leadely product behavior.

---

# 16. Mantine theme implementation

The design-system source of truth should live in a dedicated Mantine theme instead of page-level styling. MantineProvider exposes the theme and CSS variables globally; Leadely should leverage that rather than maintaining a separate Tailwind token layer.

Suggested structure:

```text
src/theme/
  index.ts
  leadely-theme.ts
  css-variables.ts
  component-defaults.ts
  semantic.ts

src/styles/
  globals.css
  leadely-shell.module.css
```

## 16.1 Theme

Use the actual Mantine version installed in the repository. The following is a design target; adapt minor API differences to the installed version rather than changing packages simply to match this snippet.

```ts
import { createTheme } from '@mantine/core';

export const leadelyTheme = createTheme({
  primaryColor: 'leadely',
  primaryShade: 6,
  fontFamily: 'var(--font-geist), Geist, Inter, sans-serif',
  headings: {
    fontFamily: 'var(--font-geist), Geist, Inter, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',

  colors: {
    leadely: [
      '#ECFDF5', // 0
      '#D1FAE5', // 1
      '#A7F3D0', // 2
      '#6EE7B7', // 3
      '#34D399', // 4
      '#10B981', // 5
      '#059669', // 6
      '#047857', // 7
      '#065F46', // 8
      '#064E3B', // 9
    ],
    teal: [
      '#F0FDFA',
      '#CCFBF1',
      '#99F6E4',
      '#5EEAD4',
      '#2DD4BF',
      '#14B8A6',
      '#0D9488',
      '#0F766E',
      '#115E59',
      '#134E4A',
    ],
  },

  radius: {
    xs: '6px',
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '14px',
  },

  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.03)',
    sm: '0 4px 14px rgba(15, 23, 42, 0.04)',
    md: '0 12px 32px rgba(15, 23, 42, 0.08)',
  },
});
```

**Important:** Mantine custom color palettes require the number of shades expected by the installed Mantine version. Keep `leadely` as the semantic primary color rather than passing random hex values to individual buttons.

## 16.2 Leadely semantic CSS variables

Mantine should own component/theme primitives, while a small semantic layer can describe product surfaces that do not map cleanly to a standard Mantine color token.

```ts
import type { CSSVariablesResolver } from '@mantine/core';

export const leadelyCssVariables: CSSVariablesResolver = () => ({
  variables: {
    '--ld-gradient-brand':
      'linear-gradient(135deg, #059669 0%, #10B981 45%, #14B8A6 100%)',
    '--ld-gradient-ai':
      'linear-gradient(135deg, rgba(236,253,245,.86) 0%, rgba(240,253,250,.96) 100%)',
    '--ld-shadow-panel': '0 1px 2px rgba(15,23,42,.03)',
    '--ld-shadow-float': '0 12px 32px rgba(15,23,42,.08)',
  },
  light: {
    '--ld-canvas': '#F8FAFA',
    '--ld-surface': '#FFFFFF',
    '--ld-surface-subtle': '#F7FAF9',
    '--ld-text': '#0F172A',
    '--ld-text-muted': '#64748B',
    '--ld-border': '#E2E8F0',
    '--ld-divider': '#EEF2F6',
  },
  dark: {
    // Dark mode is not part of the current visual phase.
    // Keep values safe if the app already supports dark mode, but do not redesign it now.
    '--ld-canvas': '#0B1220',
    '--ld-surface': '#0F172A',
    '--ld-surface-subtle': '#111C2D',
    '--ld-text': '#F8FAFC',
    '--ld-text-muted': '#94A3B8',
    '--ld-border': '#243247',
    '--ld-divider': '#1E293B',
  },
});
```

Provider target:

```tsx
<MantineProvider
  theme={leadelyTheme}
  cssVariablesResolver={leadelyCssVariables}
  defaultColorScheme="light"
>
  {children}
</MantineProvider>
```

Do not create a second token system with duplicated Tailwind variables.

## 16.3 Global component defaults

Use Mantine component extension/default props for repeated visual rules. Exact API names may differ slightly by installed version.

Target behavior:

- `Button`: `h=40`, `radius="md"`, medium weight.
- `ActionIcon`: 38–40px for top-level actions; 32–34px in rows.
- `TextInput`, `Select`, `NumberInput`, `Textarea`: `radius="md"`; standard controls 40px high.
- `Paper`: default border is not forced globally; Leadely panels explicitly use `withBorder`.
- `Modal`: `radius="lg"`, generous body padding, soft overlay.
- `Drawer`: quiet border and no oversized title.
- `Badge`: compact, not pill-heavy; use semantic colors.
- `Tooltip`: small, high contrast, short delay.
- `Table`: do not apply strong zebra striping globally.

Example direction:

```ts
import {
  ActionIcon,
  Badge,
  Button,
  Modal,
  Select,
  TextInput,
  Textarea,
} from '@mantine/core';

export const componentDefaults = {
  Button: Button.extend({
    defaultProps: { h: 40, radius: 'md' },
  }),
  ActionIcon: ActionIcon.extend({
    defaultProps: { radius: 'md' },
  }),
  TextInput: TextInput.extend({
    defaultProps: { size: 'sm', radius: 'md' },
  }),
  Select: Select.extend({
    defaultProps: { size: 'sm', radius: 'md' },
  }),
  Textarea: Textarea.extend({
    defaultProps: { radius: 'md' },
  }),
  Badge: Badge.extend({
    defaultProps: { radius: 'sm', variant: 'light' },
  }),
  Modal: Modal.extend({
    defaultProps: { radius: 'lg', centered: true },
  }),
};
```

Merge these into the project theme instead of redefining props on every page.

---

# 17. Mantine composition patterns

## 17.1 Standard panel

Prefer:

```tsx
<Paper withBorder radius="xl" p="lg" className={classes.panel}>
  ...
</Paper>
```

`panel` should use the semantic surface/border tokens and at most `shadow-xs`. Do not make all `Paper` instances look elevated.

## 17.2 AI panel

```tsx
<Paper withBorder radius="xl" p="lg" className={classes.aiPanel}>
  ...
</Paper>
```

```css
.aiPanel {
  background: var(--ld-gradient-ai);
  border-color: color-mix(in srgb, var(--mantine-color-leadely-5) 16%, transparent);
}
```

The AI area should still use normal Mantine `Button`, `TextInput`, `ActionIcon` and `Text` components.

## 17.3 Layout

Use Mantine composition primitives first:

```tsx
<Stack gap="lg">
  <PageHeader />
  <SimpleGrid cols={{ base: 1, lg: 4 }} spacing="md">
    ...
  </SimpleGrid>
  <Grid gutter="md">
    ...
  </Grid>
</Stack>
```

For this phase, `base` responsiveness is a technical fallback only. The design target remains desktop; do not spend time designing mobile navigation.

## 17.4 AppShell

Use Mantine `AppShell` as the structural primitive and keep the Leadely visual layout controlled by theme/CSS modules:

```tsx
<AppShell
  navbar={{ width: 224, breakpoint: 'md', collapsed: { mobile: true } }}
  padding={0}
>
  <AppShell.Navbar>...</AppShell.Navbar>
  <AppShell.Main>...</AppShell.Main>
</AppShell>
```

Do not make the Mantine `Header` a visually heavy global bar if the approved reference uses a lighter content-top utility row. The structure can be Mantine-driven without looking like a stock Mantine demo.

## 17.5 Styling priority

When choosing how to style something, follow this order:

1. Theme token / component default.
2. Mantine prop (`p`, `gap`, `c`, `bg`, `radius`, etc.) for simple semantic values.
3. CSS Module / `classNames` for reusable component appearance and states.
4. `vars` or component Styles API when the component exposes the right variables.
5. Inline `style` only for a true one-off dynamic calculation.

Avoid large `styles={{ ... }}` objects copied across files.

---

# 18. Visual QA checklist

Before calling a screen complete, Cursor must verify:

### Composition

- [ ] Clear page title hierarchy.
- [ ] One visual anchor per screen.
- [ ] No unnecessary nested cards.
- [ ] 14–16px panel gaps are consistent.
- [ ] Content does not feel stretched on 1440px.

### Color

- [ ] White is the dominant surface.
- [ ] Green is used as emphasis, not wallpaper.
- [ ] No unapproved purple AI theme.
- [ ] Borders are visible but quiet.

### Typography

- [ ] Geist is used throughout product UI.
- [ ] No fake recreation of Leadely logo wordmark.
- [ ] Metadata is visually subordinate.
- [ ] Numeric metrics use tabular alignment where useful.

### Components

- [ ] Buttons follow one of the documented variants.
- [ ] Inputs are 40px high by default.
- [ ] Main panels use 12–14px radius.
- [ ] Tables have 48–52px rows and quiet dividers.
- [ ] Status badge colors remain semantic.

### Behavior

- [ ] Hover and focus states exist.
- [ ] Keyboard focus is visible.
- [ ] Loading does not shift major layout.
- [ ] Empty/error states use the same design language.

### Product safety

- [ ] No data model changes.
- [ ] No API/server-action changes unless required only to preserve an existing workflow after refactor.
- [ ] No future architecture features introduced.
- [ ] Current permissions continue to hide/disable restricted actions correctly.

---

# 19. Recommended implementation order for Cursor

Do not redesign every page independently.

### Stage 1 — Foundation

1. Audit current MantineProvider, theme, shared components and CSS Modules.
2. Consolidate Leadely tokens into the Mantine theme + semantic CSS variables resolver.
3. Normalize Geist typography through the theme.
4. Normalize Mantine component defaults for radius, border, focus, control height, shadows and spacing.

### Stage 2 — Application shell

5. Refactor the root layout around Mantine `AppShell`.
6. Restyle Leadely navbar/sidebar and top utility/search/actions.
7. Build only Leadely composition components such as `PageHeader`, `SectionPanel`, `MetricCard`, `StatusBadge` and `AiPanel`; use Mantine primitives directly for Button/Input/Select/Modal/etc.

### Stage 3 — Dashboard first

8. Rebuild `/app` using only current data.
9. Match the approved reference’s density, spacing and hierarchy.
10. Screenshot at 1440px and visually compare against the reference.

### Stage 4 — Main workflows

11. Quote editor.
12. Clients.
13. Modules.
14. Settings.
15. Team.
16. Billing.
17. Platform pages.

### Stage 5 — Cross-product polish

18. Loading/empty/error states.
19. Dialogs/dropdowns/toasts.
20. Keyboard/focus/accessibility pass.
21. 1280px + 1024px desktop QA.

Only after this design migration is approved should the project begin the new CRM/BD architecture phase.

---

# 20. Cursor execution prompt

Copy the following prompt into Cursor together with this document:

```text
You are refactoring the visual UI of Leadely.

Read MASTER.md first to understand current product behavior, but note that its frontend-stack section may be stale: the application frontend has been migrated to Mantine. Inspect package.json and the current repository to determine the installed Mantine packages/version. Treat the repository as source of truth for implementation details and LEADELY_DESIGN_SYSTEM_MANTINE.md as the binding visual specification.

This phase is UI-only. Preserve all current product behavior, routes, server actions, API contracts, database schema, RLS, auth, billing, quote calculation, AI Brief behavior, export behavior and role permissions.

Do NOT implement the planned future CRM architecture yet. In particular, do not add Deals, Activities, Inbox, Sequences, Meetings, Relationship Map or other new product entities merely because the dashboard reference visually contains similar concepts.

Use /docs/references/leadely-dashboard-reference.png as the visual north star for density, spacing, card hierarchy, typography, green usage, sidebar style, AI treatment and overall desktop mood. Do not copy data/features from the reference if they do not exist in the current system.

Mantine rules:
1. Use Mantine as the primary UI system. Do not recreate Mantine primitives with Tailwind utilities and do not introduce another component library.
2. Audit the existing MantineProvider/theme first. Consolidate colors, radii, typography, spacing, shadows and component defaults into a Leadely Mantine theme.
3. Use Mantine primitives directly for Button, ActionIcon, inputs, Select, Badge, Tabs, Table, Menu, Popover, Modal, Drawer, Tooltip, Skeleton and layout primitives.
4. Create custom Leadely components only for repeated product compositions such as MetricCard, SectionPanel, PageHeader, StatusBadge, AiPanel, EntityRow and QuoteSummary.
5. Prefer styling in this order: theme/defaults → Mantine props → CSS Modules/classNames → component vars/Styles API → inline style only for true dynamic one-offs.
6. Avoid duplicated styles={{...}} objects and route-specific magic colors/radii.
7. Use Mantine AppShell as the structural primitive, but visually match the approved Leadely reference instead of the stock Mantine demo aesthetic.

Implementation strategy:
1. Audit the current UI, Mantine theme/provider and shared components.
2. Establish Leadely semantic tokens in Mantine.
3. Refactor AppShell/navbar/content container and shared Leadely compositions first.
4. Restyle /app using current backend data only.
5. Refactor the quote editor because it is the flagship workflow.
6. Continue route-by-route without breaking existing handlers.
7. Remove one-off styling where a Mantine theme rule or shared Leadely composition can replace it.
8. Keep the UI desktop-first; support 1440, 1280 and 1024 widths. Do not build mobile navigation in this phase.
9. Keep white surfaces dominant, borders subtle, shadows minimal and green reserved for actions, selection, positive states, charts and AI accents.
10. Use Geist for product UI and Lucide for icons. The Leadely wordmark/logo must use supplied brand assets rather than being recreated with text/CSS.

Before modifying a route, state which existing behavior it contains and confirm that the redesign will not change that behavior. After each route, check visual consistency against the design-system checklist.

Start with the Mantine theme foundation and AppShell. Do not refactor business architecture yet.
```

---

# 21. Future architecture handoff — intentionally deferred

The next product phase should revisit Leadely around a broader BD/Sales object model such as:

`Company → Contact → Opportunity/Deal → Quote → Contract → Activity/Task`

along with contextual AI, pipeline workflows and relationship intelligence.

**Do not implement that from this document.** This line is retained only so the current visual refactor does not accidentally paint the future architecture into a corner.
