import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function workspaceHasFeature(workspaceId: string, feature: "inbox" | "calendar" | "sequences") {
  const { data, error } = await createAdminClient().rpc("workspace_feature_enabled", {
    p_workspace_id: workspaceId,
    p_feature: feature,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
