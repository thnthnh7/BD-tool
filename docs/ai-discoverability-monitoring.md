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

## Referral measurement specification

No new visitor telemetry is added by the discoverability work. Before implementing referral attribution, choose an analytics provider, document retention and consent behavior, update the privacy notice, and capture only the minimum fields needed: landing path, normalized referrer host, campaign parameters, timestamp bucket and conversion event. Do not store prompts, access tokens or workspace content in marketing analytics.
