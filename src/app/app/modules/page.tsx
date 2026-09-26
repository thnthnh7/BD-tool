import { loadWorkspaceAppData } from "@/lib/db/actions";
import { ModulesPanel } from "@/components/bd-tool/modules-panel";
import { loadKnowledgeData } from "@/features/knowledge/server/actions";

export default async function ModulesPage() {
  const [{ context, modules }, knowledge] = await Promise.all([loadWorkspaceAppData(["modules"]), loadKnowledgeData()]);
  return (
    <ModulesPanel
      key={`${modules.length}:${knowledge.documents.length}:${knowledge.drafts.length}`}
      initialModules={modules}
      initialDocuments={knowledge.documents}
      initialDrafts={knowledge.drafts}
      canEdit={context.memberRole !== "member"}
    />
  );
}
