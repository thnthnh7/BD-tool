import "server-only";

import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canUsePaidFeatures } from "@/lib/entitlements";

export async function loadAgentAccess() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const globallyEnabled = await isPlatformFlagEnabled("ai_enabled");
  const { data } = await supabase
    .from("workspace_agent_settings")
    .select("enabled, write_enabled")
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  return {
    context,
    supabase,
    enabled: globallyEnabled
      && context.plan.features.ai_agent
      && canUsePaidFeatures(context.planStatus)
      && !context.locked
      && (data?.enabled ?? true),
    writeEnabled: data?.write_enabled ?? false,
  };
}
