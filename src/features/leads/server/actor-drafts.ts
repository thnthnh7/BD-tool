import "server-only";

import { withWorkspace } from "@/lib/events";

export async function getActorInputDraft(draftId: string | undefined) {
  if (!draftId) return null;
  const { context, supabase } = await withWorkspace();
  const { data, error } = await supabase
    .from("actor_input_drafts")
    .select("id, source_id, contract_hash, input, expires_at")
    .eq("id", draftId)
    .eq("workspace_id", context.workspaceId)
    .eq("user_id", context.userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
