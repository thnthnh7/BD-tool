"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/session";
import { withWorkspace } from "@/lib/events";
import { parseSuppressionEmails } from "@/features/comms/suppression";

export async function listEngagementSuppressions() {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase.from("engagement_suppressions")
    .select("id, email, reason, source, created_at")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
    .limit(250);
  return data || [];
}

export async function addEngagementSuppressionsAction(formData: FormData) {
  const context = await requireModule("inbox");
  if (context.memberRole === "member") return { error: "Only workspace owners and admins can manage suppressions." };
  const parsed = parseSuppressionEmails(String(formData.get("emails") || ""));
  const emails = parsed.emails;
  if (parsed.tooMany) return { error: "Add no more than 500 addresses at a time." };
  if (parsed.invalid.length) return { error: `Invalid email: ${parsed.invalid.slice(0, 3).join(", ")}` };
  if (!emails.length) return { error: "Add at least one email address." };
  const { supabase } = await withWorkspace();
  const { error } = await supabase.from("engagement_suppressions").upsert(
    emails.map((email) => ({ workspace_id: context.workspaceId, email, reason: "manual", source: "manual" })),
    { onConflict: "workspace_id,email", ignoreDuplicates: true },
  );
  if (error) return { error: error.message };
  await supabase.from("sequence_enrollments").update({
    status: "stopped", next_run_at: null, paused_reason: "Stopped because the address was added to the suppression list.",
  }).eq("workspace_id", context.workspaceId).in("contact_email", emails).in("status", ["active", "paused"]);
  revalidatePath("/app/inbox");
  revalidatePath("/app/sequences");
  return { ok: true as const };
}

export async function removeEngagementSuppressionAction(formData: FormData) {
  const context = await requireModule("inbox");
  if (context.memberRole === "member") return { error: "Only workspace owners and admins can manage suppressions." };
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Suppression entry not found." };
  const { supabase } = await withWorkspace();
  const { error } = await supabase.from("engagement_suppressions").delete().eq("id", id).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/inbox");
  return { ok: true as const };
}
