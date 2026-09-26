import "server-only";
import { withWorkspace } from "@/lib/events";
import { readAllPages } from "./read-pages";
import { listInstalledSources, listSourceTitles } from "./source-actions";
import { getScrapeJobSummary } from "./scrape-actions";
import { isMapsActor, MAPS_SLUG } from "../maps-source";

const PAGE_SIZE = 20;
const quote = (value: string) => JSON.stringify(value);

export async function listScrapeHistory(params: { q: string; page: number; source?: string; status?: string; period?: string }, legacySource: string) {
  const { context, supabase } = await withWorkspace();
  // Only small source references are scanned for the actor dropdown. Run input,
  // logs, costs and creator profiles are fetched for the visible page only.
  const [sources, references, summary] = await Promise.all([
    listInstalledSources(),
    readAllPages((from, to) => supabase.from("lead_scrape_jobs").select("source_id,apify_actor_id")
      .eq("workspace_id", context.workspaceId).order("id").range(from, to)),
    getScrapeJobSummary(),
  ]);
  const extraTitles = await listSourceTitles(references.map(r => r.source_id).filter((id): id is string => Boolean(id)));
  const titles = new Map([...sources.map(s => [s.id, s.title] as const), ...extraTitles.map(s => [s.id, s.title] as const)]);
  const actorOptions = new Map(sources.map(s => [s.id, s.title]));
  const actorKey = (r: typeof references[number]) => r.source_id || sources.find(s => s.slug === (r.apify_actor_id === "demo" ? MAPS_SLUG : r.apify_actor_id.replaceAll("~", "/")))?.id || r.apify_actor_id;
  const sourceName = (r: typeof references[number]) => (r.source_id && titles.get(r.source_id)) || (isMapsActor(r.apify_actor_id) || r.apify_actor_id === "demo" ? "Google Maps Scraper" : r.apify_actor_id || legacySource);
  for (const r of references) actorOptions.set(actorKey(r), sourceName(r));
  const source = actorOptions.has(params.source || "") ? params.source! : "";
  const statuses = ["queued", "running", "ingesting", "succeeded", "failed", "canceled"];
  const status = statuses.includes(params.status || "") ? params.status! : "";
  const period = ["7", "30", "90"].includes(params.period || "") ? params.period! : "";
  const actorFilter = (refs: typeof references) => {
    const ids = [...new Set(refs.flatMap(r => r.source_id ? [r.source_id] : []))];
    const legacy = [...new Set(refs.filter(r => !r.source_id).map(r => r.apify_actor_id))];
    return [ids.length ? `source_id.in.(${ids.map(quote).join(",")})` : "", legacy.length ? `and(source_id.is.null,apify_actor_id.in.(${legacy.map(quote).join(",")}))` : ""].filter(Boolean);
  };
  const buildQuery = () => {
    let query = supabase.from("lead_scrape_jobs")
      .select("id,source_id,apify_actor_id,query,location,status,places_found,people_found,apify_usage_usd,created_at,created_by", { count: "exact" })
      .eq("workspace_id", context.workspaceId);
    if (source) {
      const conditions = actorFilter(references.filter(r => actorKey(r) === source));
      // An installed actor may have no runs yet.
      query = conditions.length ? query.or(conditions.join(",")) : query.eq("source_id", source);
    }
    if (status) query = query.eq("status", status);
    if (period) query = query.gte("created_at", new Date(Date.now() - Number(period) * 86400000).toISOString());
    if (params.q) {
      const needle = params.q.toLowerCase();
      const pattern = quote(`%${params.q.replace(/[\\%_]/g, "\\$&")}%`);
      query = query.or([`query.ilike.${pattern}`, `location.ilike.${pattern}`, ...actorFilter(references.filter(r => sourceName(r).toLowerCase().includes(needle)))].join(","));
    }
    return query.order("created_at", { ascending: false }).order("id");
  };
  let page = Math.max(1, params.page);
  let result = await buildQuery().range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (result.error) throw new Error(result.error.message);
  const total = result.count || 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) {
    page = pageCount;
    result = await buildQuery().range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
  }
  const jobs = result.data || [];
  const creatorIds = [...new Set(jobs.flatMap(j => j.created_by ? [j.created_by] : []))];
  const creators = creatorIds.length ? await supabase.from("profiles").select("id,display_name,email").in("id", creatorIds) : { data: [], error: null };
  if (creators.error) throw new Error(creators.error.message);
  const creatorsById = new Map((creators.data || []).map(c => [c.id, c]));
  const rows = jobs.map(job => ({ ...job, creator: job.created_by ? creatorsById.get(job.created_by) || null : null }));
  return { sources, titles, actorOptions, summary, source, status, period, statuses,
    paged: { rows, total, page, pageCount, from: total ? (page - 1) * PAGE_SIZE + 1 : 0, to: Math.min(page * PAGE_SIZE, total) } };
}
