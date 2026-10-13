import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context || context.kind !== "workspace") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin && site && new URL(origin).origin !== new URL(site).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { workspaceId?: string; path?: string };
  if (body.workspaceId !== context.workspaceId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const path = String(body.path || "/app");
  if (!path.startsWith("/app") || path.startsWith("//")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_product_activity", { p_workspace_id: context.workspaceId, p_path: path });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
