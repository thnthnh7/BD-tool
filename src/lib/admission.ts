import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type AdmissionClient = SupabaseClient<Database>;
type GateResult = { ok: true } | { error: string; status: 429 | 503 };

export async function admit(
  supabase: AdmissionClient,
  subject: string,
  bucket: string,
  maxHits: number,
  windowSeconds: number,
): Promise<GateResult> {
  const { data, error } = await supabase.rpc("admit", {
    p_subject: subject,
    p_bucket: bucket,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });
  if (error) return { error: error.message, status: 503 as const };
  if (!data) return { error: "Quá nhiều yêu cầu. Thử lại sau một phút.", status: 429 as const };
  return { ok: true as const };
}

export async function acquireHold(
  supabase: AdmissionClient,
  subject: string,
  bucket: string,
  ttlSeconds: number,
): Promise<GateResult> {
  const { data, error } = await supabase.rpc("acquire_hold", {
    p_subject: subject,
    p_bucket: bucket,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) return { error: error.message, status: 503 as const };
  if (!data) return { error: "Đang có một yêu cầu khác đang chạy. Thử lại sau ít giây.", status: 429 as const };
  return { ok: true as const };
}

export async function releaseHold(supabase: AdmissionClient, subject: string, bucket: string) {
  const { error } = await supabase.rpc("release_hold", {
    p_subject: subject,
    p_bucket: bucket,
  });
  if (error) console.error("release_hold failed", error.message);
}
