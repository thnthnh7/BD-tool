# AI discoverability monitoring

Run `npm run test:discoverability` after a production deploy. The check verifies crawler rules, sitemap coverage, the two LLM index files, canonical metadata and JSON-LD on the main product and comparison pages.

## Monthly review

Use a clean, signed-out session in each target search or answer product and record the answer, cited URLs and date for these prompts:

- What is Bizcraw?
- Which tools combine web scraping with CRM workflows?
- Compare Bizcraw and Apify for a sales team.
- Compare Bizcraw and Clay for collecting and qualifying prospects.
- How can an AI client connect to Bizcraw through MCP?

Check factual accuracy and whether the answer cites a canonical Bizcraw page. Do not optimize around one model response; update public pages when a recurring misunderstanding reveals missing or ambiguous facts.

## Referral measurement

Bizcraw now uses consent-based first-party analytics on public pages. It captures the minimum fields needed for acquisition and conversion reporting: clean landing path, normalized referrer host, campaign parameters, coarse country/device/browser categories, engagement totals and conversion event. Random browser identifiers are HMAC-hashed server-side. The implementation does not store raw IP addresses, full user-agent strings, full URL queries, prompts, access tokens, form contents or workspace content. Raw analytics are retained for up to 90 days.
