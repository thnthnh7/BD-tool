import { createClient } from "@/lib/supabase/server";

export type PlatformFlag = "signup_enabled" | "ai_enabled" | "scrape_enabled" | "share_enabled";

export async function isPlatformFlagEnabled(flag: PlatformFlag) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_flags")
    .select("signup_enabled, ai_enabled, scrape_enabled, share_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return true;
  return data[flag];
}
