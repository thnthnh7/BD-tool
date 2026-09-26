# Local navigation measurement — 2026-09-26

Measured against the running Next.js development server at localhost:3000,
using the existing signed-in workspace (18,128 catalog actors, 7 installed,
4 scrape runs). No actors were started and no billing actions were performed.

## Method

Three alternating sidebar navigations: Sources → Scrape → Sources. Each sample
starts immediately before the automation click and ends when the run table or
the Google Maps Scraper card becomes visible. Samples include browser automation
transport overhead. They are end-to-end local observations, not isolated server
timings, production benchmarks, or a controlled cold-cache experiment.

Baseline includes the preceding optimization of Sources selects/counts and the
parallel plan/override reads. The first visit can have different compile/cache
state. No restart or forced cache purge was used between samples.

| Route | Before (ms) | After (ms) | Median before → after |
| --- | --- | --- | --- |
| Sources | 4692, 4814, 4949 | 3140, 3149, 3150 | 4814 → 3149 (34.6% lower) |
| Scrape | 1590, 3441, 3492 | 2208, 3159, 3145 | 3441 → 3145 (8.6% lower) |

The small sample and network variability do not establish a guaranteed speedup.
Sources readiness excludes the independently streamed account panel; that panel
can finish later. Scrape readiness still includes the account data. Hover/focus
prefetch is included in the interaction path and is not independently attributed.

## Changes

- Cache public, unfiltered catalog pages for 60 seconds. Session authorization
  and workspace-installed state are never cached across requests. Filtered
  catalog requests remain live. Import changes become visible after cache
  revalidation; this does not delay install/uninstall state updates.
- Stream Sources account data separately, lazy-load actor images, reuse the
  number formatter, and use Next Form for filter navigation.
- Sidebar prefetch only on user hover/focus, throttled per item; no whole-sidebar
  prefetch on mount. Add route loading boundaries for Sources and Scrape.
- Query only the visible 20 scrape runs and their creator profiles. Keep lightweight
  source references for dropdown options and legacy actor matching; this reference
  scan still grows with run history and is a candidate for a future distinct-source
  database query if measurements justify a migration.
- Rerun reads only saved inputs, never prior datasets/contacts. Stream the actor
  form. Maps form rendering avoids credential reads; submission still validates
  credentials in the existing start action.
- Settings, Modules, Quotes, Contracts and Dashboard request only the portions of
  the shared workspace loader that they use. Default behavior remains compatible.

## Validation

- `node scripts/check-navigation-loaders.mjs`: catalog filters, tenant constraints,
  out-of-range pagination, 53-run history paging, creator attribution, role guards,
  blocked accounts and plan overrides. Database latency in this script is simulated
  and is not used in the table above.
- TypeScript and targeted ESLint checks.
- Browser: Sources catalog and Scrape history render; searching Google Maps plus
  Completed returns one run; New run renders the Maps input form without starting it.

## Follow-up measurement

Compare a production build on the deployment region against Supabase, with more
samples and separate server/query timing before deciding on additional indexes,
virtualization, or broader caching. Do not infer those changes are necessary from
these development measurements alone.
