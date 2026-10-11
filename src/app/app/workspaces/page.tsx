import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceManager } from "@/components/workspace-manager";

export default async function WorkspacesPage() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { data: summaries } = await supabase.rpc("list_my_workspaces");
  const workspaces = summaries?.length ? summaries.map((workspace) => ({
    id: workspace.id, name: workspace.name, type: workspace.type, role: workspace.role,
    providerCostUsd: Number(workspace.provider_cost_usd || 0),
  })) : context.availableWorkspaces.map((workspace) => ({ ...workspace, providerCostUsd: 0 }));
  return <WorkspaceManager canCreate={context.memberRole !== "member"} currentId={context.workspaceId} workspaces={workspaces} />;
}
