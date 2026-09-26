// Read-only loader regression checks with deterministic database fixtures.
// Timing is simulated database latency, not a production benchmark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  } }, { filename: file });
  return exports;
}

function database(resolve) {
  const calls = [];
  let active = 0;
  let maxConcurrent = 0;
  const client = { from(table) {
    const q = { table, filters: [], orders: [] };
    const builder = {
      select(columns, options) { Object.assign(q, { columns, options }); return this; },
      eq(key, value) { q.filters.push(['eq', key, value]); return this; },
      gte(key, value) { q.filters.push(['gte', key, value]); return this; },
      is(key, value) { q.filters.push(['eq', key, value]); return this; },
      in(key, value) { q.filters.push(['in', key, value]); return this; },
      not(key, op, value) { q.filters.push(['not', key, value]); return this; },
      contains(key, value) { q.filters.push(['contains', key, value]); return this; },
      or(value) { q.search = value; return this; },
      order(key, options) { q.orders.push([key, options]); return this; },
      range(from, to) { q.range = [from, to]; return this; },
      single() { return this; }, maybeSingle() { return this; },
      then(ok, fail) {
        calls.push(structuredClone(q));
        maxConcurrent = Math.max(maxConcurrent, ++active);
        return new Promise((r) => setTimeout(() => { active--; r(resolve(q)); }, 15)).then(ok, fail);
      },
    };
    return builder;
  } };
  return { client, calls, get maxConcurrent() { return maxConcurrent; } };
}

async function sources(filters = {}, installed = ['s0'], failTable) {
  const rows = Array.from({ length: 205 }, (_, i) => ({
    id: `s${i}`, title: `Actor ${i}`, description: i % 2 ? 'social' : 'maps',
    picture_url: null, slug: `actor/${i}`, categories: [i % 2 ? 'social' : 'maps'],
    pricing_model: 'PAY_PER_EVENT', pricing_info: null, review_rating: 5,
    review_count: 1, total_users: 1000 - i, adapter_status: i % 2 ? 'preview' : 'ready',
    archived_at: null, input_schema: { large: 'unused' },
  }));
  const db = database((q) => {
    if (q.table === failTable) return { data: null, count: null, error: new Error('database unavailable') };
    if (q.table === 'workspace_scrape_sources') {
      assert.deepEqual(q.filters, [['eq', 'workspace_id', 'w1']]);
      return { data: installed.map(source_id => ({ source_id })), error: null };
    }
    let result = rows.filter(row => q.filters.every(([op, key, value]) => {
      if (op === 'eq') return row[key] === value;
      if (op === 'in') return value.includes(row[key]);
      if (op === 'not') return !value.slice(1, -1).split(',').includes(row[key]);
      return value.every(v => row[key].includes(v));
    }));
    if (q.search) result = result.filter(row => row.description === 'social');
    const count = result.length;
    if (q.range) result = result.slice(q.range[0], q.range[1] + 1);
    return { data: q.options?.head ? null : result, count, error: null };
  });
  const catalog = load('src/features/leads/server/catalog-page.ts', {
    'server-only': {}, 'next/cache': { unstable_cache: fn => fn },
    '@/lib/supabase/admin': { createAdminClient: () => db.client },
  });
  const api = load('src/features/leads/server/source-actions.ts', {
    './catalog-page': catalog,
    'next/cache': { revalidatePath() {} }, '@/features/leads/maps-source': { MAPS_SLUG: 'maps' },
    '@/features/leads/server/actor-schema': {},
    '@/lib/events': { withWorkspace: async () => ({ context: { workspaceId: 'w1' }, supabase: db.client }) },
  });
  const start = performance.now();
  const result = await api.listScrapeSources({ q: '', page: 1, adapter: '', installed: '', category: '', ...filters });
  return { result, calls: db.calls, maxConcurrent: db.maxConcurrent, ms: performance.now() - start };
}

async function session(options = {}, method = 'getSessionContext') {
  const fixtures = {
    profiles: { status: options.status || 'active', preferred_locale: 'vi' },
    platform_admins: options.platform ? { role: options.platform } : null,
    workspace_members: options.noMembership ? null : { role: options.role || 'owner', workspace_id: 'w1' },
    workspaces: options.noWorkspace ? null : { id: 'w1', name: 'Workspace', type: 'company', plan_id: 'p1', plan_status: 'active', locked: false, archived_at: options.archived ? '2026-01-01' : null },
    plans: options.noPlan ? null : { id: 'p1' },
    workspace_overrides: { quotas: { seats: 5 }, features: { lead_scrape: true } },
  };
  const db = database(q => ({ data: fixtures[q.table] }));
  let signedOut = false;
  db.client.auth = {
    getUser: async () => ({ data: { user: options.noUser ? null : { id: 'u1', email: 'test@example.com' } } }),
    signOut: async () => { signedOut = true; },
  };
  const api = load('src/lib/auth/session.ts', {
    'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`); } },
    react: { cache: fn => fn }, '@/lib/supabase/server': { createClient: async () => db.client },
    '@/lib/entitlements': { parsePlan: p => p, applyPlanOverrides: (p, quotas, features) => ({ ...p, quotas, features }) },
    '@/i18n/config': { defaultLocale: 'en', isAppLocale: v => v === 'vi' },
  });
  const start = performance.now();
  try { return { result: await api[method](), calls: db.calls, maxConcurrent: db.maxConcurrent, ms: performance.now() - start }; }
  catch (error) { return { error: error.message, signedOut, calls: db.calls }; }
}

async function historyCheck() {
  const records = Array.from({ length: 53 }, (_, i) => ({ id: `j${i}`, source_id: 's1', apify_actor_id: 'author/actor', status: i % 2 ? 'failed' : 'succeeded', created_by: 'u1' }));
  const db = database(q => {
    if (q.table === 'profiles') return { data: [{ id: 'u1', display_name: 'Owner', email: 'test@example.com' }], error: null };
    assert.ok(q.filters.some(([op, key, value]) => op === 'eq' && key === 'workspace_id' && value === 'w1'));
    let rows = records.filter(r => q.filters.every(([op, key, value]) => key === 'workspace_id' || op !== 'eq' || r[key] === value));
    const count = rows.length;
    if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
    return { data: rows, count, error: null };
  });
  const api = load('src/features/leads/server/scrape-history.ts', {
    'server-only': {}, '@/lib/events': { withWorkspace: async () => ({ context: { workspaceId: 'w1' }, supabase: db.client }) },
    './read-pages': { readAllPages: async read => (await read(0, 499)).data },
    './source-actions': { listInstalledSources: async () => [{ id: 's1', title: 'Actor', slug: 'author/actor' }], listSourceTitles: async () => [] },
    './scrape-actions': { getScrapeJobSummary: async () => ({ total: 53, active: 0 }) },
    '../maps-source': { MAPS_SLUG: 'maps', isMapsActor: () => false },
  });
  const first = await api.listScrapeHistory({ q: '', page: 1 }, 'Legacy');
  assert.equal(first.paged.rows.length, 20);
  assert.equal(first.paged.total, 53);
  assert.equal(first.paged.rows[0].creator.display_name, 'Owner');
  const last = await api.listScrapeHistory({ q: '', page: 99 }, 'Legacy');
  assert.equal(last.paged.page, 3);
  assert.equal(last.paged.rows.length, 13);
  const failed = await api.listScrapeHistory({ q: '', page: 1, status: 'failed' }, 'Legacy');
  assert.equal(failed.paged.total, 26);
  assert.ok(failed.paged.rows.every(r => r.status === 'failed'));
  assert.ok(db.calls.filter(q => q.table === 'lead_scrape_jobs').every(q => q.columns !== '*'));
}

(async () => {
  await historyCheck();
  const basic = await sources();
  assert.equal(basic.result.rows.length, 200);
  assert.equal(basic.result.total, 205);
  assert.equal(basic.result.catalogTotal, 205);
  assert.equal(basic.result.rows[0].installed, true);
  assert.equal('input_schema' in basic.result.rows[0], false);
  assert.equal(basic.calls.length, 2);
  assert.equal(basic.maxConcurrent, 2);
  assert.equal(basic.calls.find(q => q.table === 'scrape_sources').columns.includes('*'), false);
  const last = await sources({ page: 99 });
  assert.equal(last.result.page, 2);
  assert.equal(last.result.rows.length, 5);
  const yes = await sources({ installed: 'yes' });
  assert.equal(yes.result.total, 1);
  assert.equal(yes.result.catalogTotal, 205);
  assert.equal((await sources({ installed: 'no' })).result.total, 204);
  assert.equal((await sources({ installed: 'yes' }, [])).result.total, 0);
  assert.equal((await sources({ installed: 'no' }, [])).result.total, 205);
  assert.equal((await sources({ category: 'social' })).result.total, 102);
  assert.equal((await sources({ adapter: 'ready' })).result.total, 103);
  assert.equal((await sources({ q: 'social' })).result.total, 102);
  await assert.rejects(sources({}, ['s0'], 'scrape_sources'), /database unavailable/);
  await assert.rejects(sources({}, ['s0'], 'workspace_scrape_sources'), /database unavailable/);
  await assert.rejects(sources({ installed: 'yes' }, [], 'scrape_sources'), /database unavailable/);
  const owner = await session();
  assert.equal(owner.maxConcurrent, 2);
  assert.equal(owner.result.kind, 'workspace');
  assert.equal(owner.result.plan.quotas.seats, 5);
  assert.equal(owner.result.locale, 'vi');
  for (const role of ['owner', 'admin', 'member']) assert.equal((await session({ role })).result.memberRole, role);
  for (const status of ['suspended', 'deleted']) {
    const result = await session({ status });
    assert.equal(result.error, 'redirect:/login');
    assert.equal(result.signedOut, true);
    assert.equal(result.calls.length, 1);
  }
  for (const platform of ['super_admin', 'support']) {
    const result = await session({ platform });
    assert.equal(result.result.kind, 'platform');
    assert.equal(result.calls.length, 2);
  }
  assert.equal((await session({ noUser: true })).result, null);
  for (const key of ['noMembership', 'noWorkspace', 'noPlan']) assert.equal((await session({ [key]: true })).result.kind, 'onboarding');
  assert.equal((await session({ archived: true })).result.locked, true);
  assert.equal((await session({ role: 'member' }, 'requireOwnerOrAdmin')).error, 'redirect:/app');
  assert.equal((await session({ role: 'admin' }, 'requireOwner')).error, 'redirect:/app');
  console.log('PASS: catalog filters, tenant scope, pagination, account guards and plan overrides');
  console.log(JSON.stringify({ simulatedLatencyPerQueryMs: 15, sources: { queries: basic.calls.length, ms: Math.round(basic.ms) }, session: { queries: owner.calls.length, ms: Math.round(owner.ms) } }));
})().catch(error => { console.error(error); process.exitCode = 1; });
