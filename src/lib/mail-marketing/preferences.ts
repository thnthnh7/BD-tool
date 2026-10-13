"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function enableBetaEmailsAction() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("email_preferences").upsert({ user_id: context.userId, product_tips: true, beta_updates: true, unsubscribed_all: false, consent_source: "beta_welcome", consent_at: new Date().toISOString(), unsubscribed_at: null });
  if (error) throw new Error(error.message);
  revalidatePath("/app/beta-welcome");
}
