import { loadWorkspaceAppData } from "@/lib/db/actions";
import { ModulesPanel } from "@/components/bd-tool/modules-panel";

export default async function ModulesPage() {
  const { context, modules } = await loadWorkspaceAppData();
  return <ModulesPanel initialModules={modules} canEdit={context.memberRole !== "member"} />;
}
