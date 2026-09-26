import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { isValidShareId } from "@/lib/share-id";
import { loadSharedQuote } from "@/lib/share-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await isPlatformFlagEnabled("share_enabled"))) {
    return NextResponse.json({ error: "Public sharing is paused." }, { status: 503 });
  }
  if (!isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase.from("public_quotes").select("payload").eq("id", id).maybeSingle();
  if (data?.payload) {
    return NextResponse.json(data.payload, { headers: { "Cache-Control": "private, no-cache" } });
  }

  const blob = await loadSharedQuote(id).catch(() => null);
  if (!blob) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  return NextResponse.json(blob, { headers: { "Cache-Control": "private, no-cache" } });
}
