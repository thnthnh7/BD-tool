"use server";

import { revalidatePath } from "next/cache";
import { MAPS_SLUG } from "@/features/leads/maps-source";
import { ensureSourceContract } from "@/features/leads/server/actor-schema";
import { withWorkspace } from "@/lib/events";
import type { Json } from "@/lib/database.types";
import { CATALOG_CARD_COLUMNS, getCatalogPage } from "./catalog-page";
import { requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";
const SOURCES_PAGE_SIZE = 200;

export type SourceListFilters = {
  q: string;
  page: number;
  adapter: string;
  installed: string;
  category: string;
};

function searchNeedle(query: string) {
  return query.replace(/[%_"\\(),]/g, " ").replace(/\s+/g, " ").trim();
}

export async function listScrapeSources(filters: SourceListFilters) {
  const { context, supabase } = await withWorkspace();
  const installsQuery = supabase
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", context.workspaceId);
  const needle = searchNeedle(filters.q);
  const hasAdapter = filters.adapter === "ready" || filters.adapter === "preview";
  const filtersByInstallation = filters.installed === "yes" || filters.installed === "no";
  const isFiltered = Boolean(needle || filters.category || hasAdapter || filtersByInstallation);
  // The page count is also the catalog count when there are no filters.
  const catalogQuery = isFiltered ? supabase
    .from("scrape_sources")
    .select("id", { count: "exact", head: true })
    .eq("pricing_model", "PAY_PER_EVENT")
    .is("archived_at", null) : Promise.resolve(null);

  // Only installation filters depend on the workspace's installed IDs.
  // Await both reads together so failures cannot leave a rejected promise behind.
  const [earlyInstalls, earlyCatalog] = filtersByInstallation
    ? await Promise.all([installsQuery, catalogQuery])
    : [null, null];
  if (earlyInstalls?.error) throw new Error(earlyInstalls.error.message);
  if (earlyCatalog?.error) throw new Error(earlyCatalog.error.message);
  const filterIds = (earlyInstalls?.data || []).map((row) => row.source_id);

  const empty = {
    rows: [] as Array<{
      id: string;
      title: string;
      description: string;
      picture_url: string | null;
      slug: string;
      categories: string[];
      pricing_model: string | null;
      pricing_info: Json | null;
      review_rating: number | null;
      review_count: number;
      total_users: number;
      adapter_status: string;
      installed: boolean;
    }>,
    total: 0,
    catalogTotal: earlyCatalog?.count || 0,
    page: 1,
    pageCount: 1,
    from: 0,
    to: 0,
    installedIds: filterIds,
  };

  if (filters.installed === "yes" && filterIds.length === 0) return empty;

  let query = supabase.from("scrape_sources").select(CATALOG_CARD_COLUMNS, { count: "exact" }).is("archived_at", null).eq("pricing_model", "PAY_PER_EVENT");
  if (filters.adapter === "ready" || filters.adapter === "preview") query = query.eq("adapter_status", filters.adapter);
  if (filters.category) query = query.contains("categories", [filters.category]);
  if (needle) {
    const pattern = `"%${needle}%"`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern},slug.ilike.${pattern}`);
  }
  if (filters.installed === "yes") query = query.in("id", filterIds);
  if (filters.installed === "no" && filterIds.length) {
    query = query.not("id", "in", `(${filterIds.join(",")})`);
  }

  const page = Math.max(1, filters.page);
  let from = (page - 1) * SOURCES_PAGE_SIZE;
  const ordered = query.order("total_users", { ascending: false }).order("id");
  const [{ data, count, error }, installs, catalog] = await Promise.all([
    isFiltered ? ordered.range(from, from + SOURCES_PAGE_SIZE - 1) : getCatalogPage(from, SOURCES_PAGE_SIZE),
    earlyInstalls || installsQuery,
    filtersByInstallation ? earlyCatalog : catalogQuery,
  ]);
  if (error) throw new Error(error.message);
  if (installs.error) throw new Error(installs.error.message);
  if (catalog?.error) throw new Error(catalog.error.message);
  const installedIds = (installs.data || []).map((row) => row.source_id);

  const total = count || 0;
  const pageCount = Math.max(1, Math.ceil(total / SOURCES_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  let pageData = data;
  if (current !== page && total > 0) {
    from = (current - 1) * SOURCES_PAGE_SIZE;
    const lastPage = isFiltered ? await ordered.range(from, from + SOURCES_PAGE_SIZE - 1) : await getCatalogPage(from, SOURCES_PAGE_SIZE);
    if (lastPage.error) throw new Error(lastPage.error.message);
    pageData = lastPage.data;
  }
  const installed = new Set(installedIds);
  const rows = (pageData || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    picture_url: row.picture_url,
    slug: row.slug,
    categories: row.categories,
    pricing_model: row.pricing_model,
    pricing_info: row.pricing_info,
    review_rating: row.review_rating,
    review_count: row.review_count,
    total_users: row.total_users,
    adapter_status: row.adapter_status,
    installed: installed.has(row.id),
  }));

  return {
    rows,
    total,
    catalogTotal: catalog?.count ?? total,
    page: current,
    pageCount,
    from: total === 0 ? 0 : from + 1,
    to: Math.min(from + rows.length, total),
    installedIds,
  };
}

export async function listInstalledSources() {
  const { context, supabase } = await withWorkspace();
  const { data: installs, error } = await supabase
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", context.workspaceId);
  if (error) throw new Error(error.message);
  const ids = (installs || []).map((row) => row.source_id);
  if (!ids.length) return [];
  const rows: Array<{ id: string; title: string; slug: string; adapter_status: string; schema_fetched_at: string | null }> = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error: sourceError } = await supabase
      .from("scrape_sources")
      .select("id, title, slug, adapter_status, schema_fetched_at")
      .eq("pricing_model", "PAY_PER_EVENT")
      .in("id", chunk)
      .is("archived_at", null);
    if (sourceError) throw new Error(sourceError.message);
    rows.push(...(data || []));
  }
  return rows.sort((a, b) => {
    const rank = (row: (typeof rows)[number]) => (row.adapter_status === "ready" ? 2 : row.schema_fetched_at ? 1 : 0);
    const ready = rank(b) - rank(a);
    if (ready) return ready;
    return a.title.localeCompare(b.title, "vi");
  });
}

export async function listSourceTitles(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const { supabase } = await withWorkspace();
  const rows: Array<{ id: string; title: string }> = [];
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    const { data, error } = await supabase.from("scrape_sources").select("id, title").in("id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
  }
  return rows;
}

export async function listInstalledReadySources() {
  const { context, supabase } = await withWorkspace();
  const { data: installs } = await supabase
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", context.workspaceId);
  const ids = (installs || []).map((row) => row.source_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("scrape_sources")
    .select("*")
    .in("id", ids)
    .eq("adapter_status", "ready")
    .eq("pricing_model", "PAY_PER_EVENT")
    .is("archived_at", null);
  return data || [];
}

export async function installScrapeSourceAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  if (context.memberRole === "member") return { error: "Chỉ owner hoặc admin được cài nguồn." };
  if (!context.plan.features.lead_scrape) return { error: "Gói hiện tại không gồm lead scrape." };
  const sourceId = String(formData.get("source_id") || "");
  if (!sourceId) return { error: "Thiếu nguồn." };
  const { data: source } = await supabase
    .from("scrape_sources")
    .select("id, slug, archived_at, pricing_model")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || source.archived_at) {
    return { error: "Nguồn này không còn trong catalog." };
  }
  if (source.pricing_model !== "PAY_PER_EVENT") return { error: "Chỉ hỗ trợ nguồn Pay per event." };
  if (source.slug !== MAPS_SLUG) {
    const contract = await ensureSourceContract(source.id);
    if (contract.error) return { error: contract.error };
  }
  const { error } = await supabase.from("workspace_scrape_sources").insert({
    workspace_id: context.workspaceId,
    source_id: source.id,
    installed_by: context.userId,
  });
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath("/app/leads/sources");
  revalidatePath("/app/leads/scrape");
  return { ok: true as const };
}

export async function uninstallScrapeSourceAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  if (context.memberRole === "member") return { error: "Chỉ owner hoặc admin được gỡ nguồn." };
  const sourceId = String(formData.get("source_id") || "");
  if (!sourceId) return { error: "Thiếu nguồn." };
  const { error } = await supabase
    .from("workspace_scrape_sources")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("source_id", sourceId);
  if (error) return { error: error.message };
  revalidatePath("/app/leads/sources");
  revalidatePath("/app/leads/scrape");
  return { ok: true as const };
}

export async function refreshActorContractAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  if (context.memberRole === "member") return { error: "Only an owner or admin can refresh an Actor definition." };
  const sourceId = String(formData.get("source_id") || "");
  if (!sourceId) return { error: "Missing Actor source." };
  const { data: installed, error: installedError } = await supabase
    .from("workspace_scrape_sources")
    .select("source_id")
    .eq("workspace_id", context.workspaceId)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (installedError) return { error: installedError.message };
  if (!installed) return { error: "This Actor is not installed in the workspace." };
  let token: string;
  try { token = (await requireWorkspaceApifyConnection(context.workspaceId)).token; }
  catch (error) { return { error: error instanceof Error ? error.message : "Connect Apify before refreshing this Actor." }; }
  const contract = await ensureSourceContract(sourceId, token, true);
  if (contract.error) return { error: contract.error };
  revalidatePath("/app/leads/scrape/new");
  revalidatePath("/app/leads/sources");
  return { ok: true as const };
}

export async function getInstalledMapsSource() {
  const sources = await listInstalledReadySources();
  return sources.find((source) => source.slug === MAPS_SLUG) || null;
}
