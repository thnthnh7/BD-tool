import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const cursor = Number(_request.nextUrl.searchParams.get("cursor") || 0);
  const { data } = await access.supabase
    .from("agent_messages")
    .select("id, role, content, blocks, status, created_at")
    .eq("conversation_id", id)
    .eq("workspace_id", access.context.workspaceId)
    .eq("user_id", access.context.userId)
    .order("created_at", { ascending: true })
    .range(cursor, cursor + 30);
  await access.supabase.from("agent_conversations").update({ unread: false }).eq("id", id).eq("workspace_id", access.context.workspaceId).eq("user_id", access.context.userId);
  return NextResponse.json({ items: data || [] });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const body = await request.json() as { title?: string; status?: "active" | "archived" };
  const patch: { title?: string; status?: "active" | "archived" } = {};
  if (typeof body.title === "string") patch.title = body.title.slice(0, 120);
  if (body.status === "active" || body.status === "archived") patch.status = body.status;
  const { error } = await access.supabase.from("agent_conversations").update(patch).eq("id", id).eq("workspace_id", access.context.workspaceId).eq("user_id", access.context.userId);
  if (error) return NextResponse.json({ error: "Conversation could not be updated." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
