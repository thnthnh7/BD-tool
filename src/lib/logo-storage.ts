import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const MAX_BYTES = 400_000;

export function decodeJpegDataUrl(dataUrl: string): { bytes: Uint8Array } | { error: string } {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) return { error: "Chỉ nhận ảnh JPEG, PNG hoặc WebP." };
  const source = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  if (bytes.byteLength < 32 || bytes.byteLength > MAX_BYTES) return { error: "Logo quá lớn hoặc không hợp lệ." };
  return { bytes };
}

export async function uploadLogoJpeg(
  supabase: SupabaseClient<Database>,
  path: string,
  dataUrl: string,
): Promise<{ url: string } | { error: string }> {
  const decoded = decodeJpegDataUrl(dataUrl);
  if ("error" in decoded) return decoded;
  const payload = new ArrayBuffer(decoded.bytes.byteLength);
  new Uint8Array(payload).set(decoded.bytes);
  const file = new Blob([payload], { type: "image/jpeg" });
  const { error } = await supabase.storage.from("logos").upload(path, file, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}
