import { get, put } from "@vercel/blob";
import type { SharedQuotePayload } from "@/lib/share";
import { createShareId, isValidShareId, shareBlobPath } from "@/lib/share-id";

export async function saveSharedQuote(payload: SharedQuotePayload): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createShareId();
    const pathname = shareBlobPath(id);

    try {
      await put(pathname, JSON.stringify(payload), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return id;
    } catch {
      // Collision or transient write error — try a new id
    }
  }

  throw new Error("Could not allocate a unique share id");
}

export async function loadSharedQuote(id: string): Promise<SharedQuotePayload | null> {
  if (!isValidShareId(id)) return null;

  const result = await get(shareBlobPath(id), { access: "private" });
  if (result?.statusCode !== 200 || !result.stream) return null;

  try {
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as SharedQuotePayload;
  } catch {
    return null;
  }
}
