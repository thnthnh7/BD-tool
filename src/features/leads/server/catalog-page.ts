import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const CATALOG_CARD_COLUMNS = "id,title,description,picture_url,slug,categories,pricing_model,pricing_info,review_rating,review_count,total_users,adapter_status";

// Public catalog metadata only. Authorization and installed state are resolved
// outside this cache on every request. Catalog imports become visible within 60s.
export const getCatalogPage = unstable_cache(async (from: number, size: number) => {
  const result = await createAdminClient().from("scrape_sources")
    .select(CATALOG_CARD_COLUMNS, { count: "exact" })
    .is("archived_at", null).eq("pricing_model", "PAY_PER_EVENT")
    .order("total_users", { ascending: false }).order("id")
    .range(from, from + size - 1);
  if (result.error) throw new Error(result.error.message);
  return result;
}, ["public-actor-catalog-cards-v1"], { revalidate: 60 });
