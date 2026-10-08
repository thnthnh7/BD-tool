"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { syncEngagementAccounts } from "@/features/comms/server/sync-engine";

export async function disconnectEngagementAccountAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const accountId = String(formData.get("account_id") || "");
  if (!accountId) return { error: "Missing account." };
  const supabase = await createClient();
  const { data: account } = await supabase.from("engagement_accounts").select("id").eq("id", accountId).eq("workspace_id", context.workspaceId).maybeSingle();
  if (!account) return { error: "Account not found." };
  const { error } = await supabase.rpc("revoke_engagement_account", { p_account_id: accountId });
  if (error) return { error: error.message };
  revalidatePath("/app/inbox");
  revalidatePath("/app/calendar");
  revalidatePath("/app/sequences");
  return { ok: true as const };
}

export async function syncEngagementAccountsAction() {
  const context = await requireOwnerOrAdmin();
  const results = await syncEngagementAccounts({ workspaceId: context.workspaceId, limit: 10 });
  revalidatePath("/app/inbox");
  revalidatePath("/app/calendar");
  revalidatePath("/app/sequences");
  const failures = results.flatMap((result) => result.errors);
  return failures.length ? { error: failures.join(" ") } : { ok: true as const };
}
