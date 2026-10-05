import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";

export async function GET(request: NextRequest) {
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const cursor = Number(request.nextUrl.searchParams.get("cursor") || 0);
  const { data, error } = await access.supabase
    .from("agent_conversations")
    .select("id, title, status, unread, updated_at")
    .eq("workspace_id", access.context.workspaceId)
    .eq("user_id", access.context.userId)
    .order("updated_at", { ascending: false })
    .range(cursor, cursor + 20);
  if (error) return NextResponse.json({ error: "Conversations could not be loaded." }, { status: 500 });
  return NextResponse.json({ items: data, nextCursor: data.length > 20 ? cursor + 20 : null });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const { data, error } = await access.supabase
    .from("agent_conversations")
    .insert({ workspace_id: access.context.workspaceId, user_id: access.context.userId })
    .select("id, title, status, unread, updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Conversation could not be created." }, { status: 500 });
  return NextResponse.json(data);
}
