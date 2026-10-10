"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/session";
import { withWorkspace } from "@/lib/events";
import { getSequenceTemplate } from "@/features/comms/sequence-templates";
import { validateSequenceStep } from "@/features/comms/sequence-validation";

export async function createSequenceFromTemplateAction(formData: FormData) {
  await requireModule("sequences");
  const { context, supabase } = await withWorkspace();
  const template = getSequenceTemplate(String(formData.get("template_id") || ""));
  if (!template) return { error: "Sequence template not found." };
  const steps = template.steps.map(validateSequenceStep);
  const invalid = steps.find((step) => "error" in step);
  if (invalid && "error" in invalid) return { error: invalid.error };
  const { data: sequence, error: sequenceError } = await supabase.from("sequences").insert({
    workspace_id: context.workspaceId,
    name: template.name,
    description: template.description,
    status: "draft",
    owner_user_id: context.userId,
  }).select("id").single();
  if (sequenceError || !sequence) return { error: sequenceError?.message || "Could not create sequence." };
  const rows = steps.map((step, index) => ({
    workspace_id: context.workspaceId,
    sequence_id: sequence.id,
    position: index + 1,
    ...("value" in step ? step.value : {}),
  }));
  const { error: stepsError } = await supabase.from("sequence_steps").insert(rows);
  if (stepsError) {
    await supabase.from("sequences").delete().eq("id", sequence.id).eq("workspace_id", context.workspaceId);
    return { error: stepsError.message };
  }
  revalidatePath("/app/sequences");
  return { ok: true as const, id: sequence.id };
}
