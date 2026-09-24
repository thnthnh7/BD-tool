import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";

export type ActivityType = Database["public"]["Tables"]["activities"]["Insert"]["activity_type"];

export async function recordActivity(input: {
  workspaceId: string;
  actorUserId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  leadId?: string | null;
  quoteId?: string | null;
  taskId?: string | null;
  activityType: string;
  title: string;
  body?: string | null;
  isSystem?: boolean;
  metadata?: Database["public"]["Tables"]["activities"]["Insert"]["metadata"];
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId ?? null,
    company_id: input.companyId ?? null,
    contact_id: input.contactId ?? null,
    deal_id: input.dealId ?? null,
    lead_id: input.leadId ?? null,
    quote_id: input.quoteId ?? null,
    task_id: input.taskId ?? null,
    activity_type: input.activityType,
    title: input.title,
    body: input.body ?? null,
    is_system: input.isSystem ?? true,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("recordActivity failed", error.message);
  }

  const stamp = new Date().toISOString();
  if (input.dealId) {
    await supabase.from("deals").update({ last_activity_at: stamp }).eq("id", input.dealId);
  }
  if (input.leadId) {
    await supabase.from("leads").update({ last_activity_at: stamp }).eq("id", input.leadId);
  }
}

export async function withWorkspace() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  return { context, supabase };
}
