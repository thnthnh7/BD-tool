import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type OnboardingProgress = {
  providerConnected: boolean;
  scrapeRunCreated: boolean;
  recordsReviewed: boolean;
  recordsImported: boolean;
  salesActionCreated: boolean;
};

export async function loadOnboardingProgress(): Promise<OnboardingProgress> {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const workspaceId = context.workspaceId;
  const [provider, scrape, reviewed, imported, tasks, deals] = await Promise.all([
    supabase.from("workspace_apify_connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("lead_scrape_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("data_records").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("review_status", ["approved", "rejected", "imported"]),
    supabase.from("data_import_batches").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  return {
    providerConnected: (provider.count || 0) > 0,
    scrapeRunCreated: (scrape.count || 0) > 0,
    recordsReviewed: (reviewed.count || 0) > 0,
    recordsImported: (imported.count || 0) > 0,
    salesActionCreated: (tasks.count || 0) > 0 || (deals.count || 0) > 0,
  };
}
