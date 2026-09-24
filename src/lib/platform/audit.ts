import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export async function recordPlatformAudit(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Json;
  after?: Json;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_platform_audit", {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_before: input.before ?? {},
    p_after: input.after ?? {},
  });
  if (error) console.error("platform audit", error.message);
}
