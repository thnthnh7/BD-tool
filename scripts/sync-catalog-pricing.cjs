// Run: node --env-file=.env.local scripts/sync-catalog-pricing.cjs
// Updates pricing only; never creates, archives, installs, or runs an Actor.
const { createClient } = require('@supabase/supabase-js');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    if (response.status !== 429 && response.status < 500) throw new Error(`Apify HTTP ${response.status}`);
    await pause(1000 * 2 ** attempt);
  }
  throw new Error('Apify retry limit reached');
}
async function main() {
  const rows = [];
  for (;;) {
    let query = db.from('scrape_sources').select('id,apify_id,slug,pricing_model').is('archived_at', null);
    if (process.argv.includes('--missing-only')) query = query.is('pricing_model', null);
    const { data, error } = await query.order('id').range(rows.length, rows.length + 999);
    if (error) throw error;
    if (!data.length) break;
    rows.push(...data);
  }
  const output = join(tmpdir(), `leadely-pricing-${Date.now()}.json`);
  writeFileSync(output, JSON.stringify({ before: rows }));
  const pending = new Map(rows.map((row) => [row.apify_id, row]));
  const pricing = new Map();
  function collect(item) {
    const row = pending.get(item.id);
    const history = Array.isArray(item.pricingInfos) ? item.pricingInfos.filter((info) => Date.parse(info.startedAt) <= Date.now()).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)) : [];
    const info = item.currentPricingInfo || history[0];
    if (!row || !info?.pricingModel) return;
    pricing.set(row.id, info);
    pending.delete(item.id);
  }
  for (const sortBy of process.argv.includes('--missing-only') ? [] : ['popularity', 'newest', 'lastUpdate', 'relevance']) {
    if (!pending.size) break;
    for (let offset = 0; offset < 16000; offset += 800) {
      const pages = await Promise.all(Array.from({ length: 8 }, (_, i) => get(`https://api.apify.com/v2/store?category=LEAD_GENERATION&limit=100&offset=${offset + i * 100}&sortBy=${sortBy}`)));
      for (const page of pages) for (const item of page?.data?.items || []) collect(item);
      console.log(`${sortBy} ${offset + 800}: matched ${pricing.size}/${rows.length}`);
      if (!pending.size || pages.some((page) => !page?.data?.items?.length)) break;
    }
  }
  const remaining = [...pending.values()];
  for (let index = 0; index < remaining.length; index += 8) {
    await Promise.all(remaining.slice(index, index + 8).map(async (row) => {
      const payload = await get(`https://api.apify.com/v2/acts/${encodeURIComponent(row.apify_id)}`);
      if (payload?.data) collect(payload.data);
    }));
    if (index % 80 === 0) console.log(`Actor detail: ${index}/${remaining.length}, matched ${pricing.size}`);
  }
  writeFileSync(output, JSON.stringify({ before: rows, pricing: Object.fromEntries(pricing), unresolved: [...pending.values()] }));
  const groups = new Map();
  for (const [id, info] of pricing) {
    if (!groups.has(info.pricingModel)) groups.set(info.pricingModel, []);
    groups.get(info.pricingModel).push(id);
  }
  for (const [model, ids] of groups) {
    for (let index = 0; index < ids.length; index += 200) {
      const { error } = await db.from('scrape_sources').update({ pricing_model: model }).in('id', ids.slice(index, index + 200));
      if (error) throw error;
    }
  }
  const counts = {};
  for (const model of groups.keys()) {
    const { count, error } = await db.from('scrape_sources').select('id', { count: 'exact', head: true }).is('archived_at', null).eq('pricing_model', model);
    if (error) throw error;
    counts[model] = count;
  }
  console.log(JSON.stringify({ total: rows.length, counts, unresolved: pending.size, snapshot: output }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
