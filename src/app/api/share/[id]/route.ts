import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { isValidShareId } from "@/lib/share-id";
import { createClient } from "@/lib/supabase/server";

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
  const { data } = await supabase.from("public_quotes").select("payload").eq("id", id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (data?.payload) {
    return NextResponse.json(data.payload, { headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({ error: "Share not found or expired" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidShareId(id)) return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await client.from("workspace_members").select("workspace_id, role").eq("user_id", auth.user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await createAdminClient().from("public_quotes").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", membership.workspace_id).is("revoked_at", null).select("id").maybeSingle();
  if (!data) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
