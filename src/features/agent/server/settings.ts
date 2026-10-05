"use server";

import { revalidatePath } from "next/cache";
import { requirePlatform, requireWorkspace } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateAgentSettingsAction(formData: FormData) {
  const context = await requireWorkspace();
  if (context.memberRole === "member") return { error: "Only an owner or admin can change assistant settings." };
  const supabase = await createClient();
  const next = {
    workspace_id: context.workspaceId,
    enabled: formData.get("enabled") === "on",
    write_enabled: formData.get("write_enabled") === "on",
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("workspace_agent_settings").upsert(next);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function setWorkspaceAgentByAdminAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const workspaceId = String(formData.get("workspace_id") || "");
  if (!workspaceId) return { error: "Workspace is required." };
  const { error } = await createAdminClient().from("workspace_agent_settings").upsert({
    workspace_id: workspaceId,
    enabled: formData.get("enabled") === "on",
    write_enabled: formData.get("write_enabled") === "on",
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/platform/health");
  return { ok: true as const };
}
