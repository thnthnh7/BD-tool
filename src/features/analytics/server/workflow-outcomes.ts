import "server-only";

import { withWorkspace } from "@/lib/events";

export async function loadWorkflowOutcomes() {
  const { context, supabase } = await withWorkspace();
  const [collected, ready, imported, enrolled, replied] = await Promise.all([
    supabase.from("data_records").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId),
    supabase.from("data_records").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId).eq("review_status", "ready"),
    supabase.from("data_records").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId).eq("review_status", "imported"),
    supabase.from("sequence_enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId),
    supabase.from("sequence_enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId).not("replied_at", "is", null),
  ]);
  return {
    collected: collected.count || 0,
    ready: ready.count || 0,
    imported: imported.count || 0,
    enrolled: enrolled.count || 0,
    replied: replied.count || 0,
  };
}
