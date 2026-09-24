import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type UsageClient = SupabaseClient<Database>;
type UsageField = "quotes_created" | "ai_briefs" | "maps_scrapes" | "maps_places" | "maps_people";

export async function incrementUsage(
  supabase: UsageClient,
  workspaceId: string,
  field: UsageField,
  amount: number,
  limit: number,
) {
  if (amount <= 0) return { ok: true as const };
  const { data, error } = await supabase.rpc("consume_quota", {
    p_workspace_id: workspaceId,
    p_field: field,
    p_amount: amount,
    p_limit: limit,
  });
  if (error) return { error: error.message };
  if (!data) return { error: `Đã hết hạn mức ${field.replaceAll("_", " ")} trong tháng.` };
  return { ok: true as const };
}
