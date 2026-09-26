import "server-only";
import { withWorkspace } from "@/lib/events";

// Rerun only needs the original input, never the dataset or enriched contacts.
export async function getScrapeInput(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data, error } = await supabase.from("lead_scrape_jobs")
    .select("id,source_id,apify_actor_id,query,location,language,max_results,max_people_per_place,enrich_people,verify_emails,filters")
    .eq("workspace_id", context.workspaceId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { job: data } : null;
}
