"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin, requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function loadKnowledgeData() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const [documents, drafts] = await Promise.all([
    supabase.from("knowledge_documents").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    supabase.from("knowledge_module_drafts").select("*").eq("workspace_id", context.workspaceId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  return { documents: documents.data || [], drafts: drafts.data || [] };
}

export async function reviewModuleDraftAction(draftId: string, decision: "approve" | "reject") {
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data: draft } = await supabase
    .from("knowledge_module_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("workspace_id", context.workspaceId)
    .eq("status", "pending")
    .maybeSingle();
  if (!draft) return { error: "Không tìm thấy đề xuất." };
  if (decision === "approve") {
    const { error } = await supabase.from("modules").insert({
      workspace_id: context.workspaceId,
      name: draft.name,
      description: draft.description,
      suggested_price: draft.suggested_price,
      category: "Imported",
      default_qty: 1,
      visual_hint: `Nguồn: ${draft.source_excerpt.slice(0, 120)}`,
    });
    if (error) return { error: error.message };
  }
  const { error } = await supabase
    .from("knowledge_module_drafts")
    .update({ status: decision === "approve" ? "approved" : "rejected" })
    .eq("id", draftId)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/modules");
  return { ok: true as const };
}

export async function deleteKnowledgeDocumentAction(documentId: string) {
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!data) return { error: "Không tìm thấy tài liệu." };
  await supabase.storage.from("knowledge-files").remove([data.storage_path]);
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", documentId).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/modules");
  return { ok: true as const };
}
