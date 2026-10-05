import { NextRequest } from "next/server";
import { acquireHold, admit, releaseHold } from "@/lib/admission";
import { canUsePaidFeatures } from "@/lib/entitlements";
import { assertSameOrigin } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";
import { runAgentTurn } from "@/features/agent/server/loop";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const access = await loadAgentAccess();
  if (!access.enabled) return Response.json({ error: "The assistant is turned off." }, { status: 403 });
  if (!access.context.plan.features.ai_agent || !canUsePaidFeatures(access.context.planStatus) || access.context.locked) {
    return Response.json({ error: "This workspace cannot use the assistant." }, { status: 403 });
  }
  const body = await request.json() as { conversationId?: string; message?: string; pathname?: string; timeZone?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required." }, { status: 400 });
  if (!body.conversationId) return Response.json({ error: "Conversation is required." }, { status: 400 });
  const held = await acquireHold(access.supabase, access.context.workspaceId, "ai_brief", 70);
  if ("error" in held) return Response.json({ error: held.error }, { status: held.status ?? 503 });
  const gate = await admit(access.supabase, access.context.workspaceId, "ai_brief", 6, 60);
  if ("error" in gate) {
    await releaseHold(access.supabase, access.context.workspaceId, "ai_brief");
    return Response.json({ error: gate.error }, { status: gate.status ?? 503 });
  }
  const { data: conversation } = await access.supabase.from("agent_conversations").select("id").eq("id", body.conversationId).eq("workspace_id", access.context.workspaceId).eq("user_id", access.context.userId).maybeSingle();
  if (!conversation) {
    await releaseHold(access.supabase, access.context.workspaceId, "ai_brief");
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }
  const requestId = crypto.randomUUID();
  await access.supabase.from("agent_messages").insert({
    conversation_id: conversation.id,
    workspace_id: access.context.workspaceId,
    user_id: access.context.userId,
    role: "user",
    content: message,
    request_id: requestId,
  });
  const title = message.slice(0, 80);
  await access.supabase.from("agent_conversations").update({ title, updated_at: new Date().toISOString(), unread: false }).eq("id", conversation.id).eq("title", "");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await runAgentTurn({
          ctx: { supabase: access.supabase, workspaceId: access.context.workspaceId, userId: access.context.userId, role: access.context.memberRole, locale: access.context.locale },
          conversationId: conversation.id,
          requestId,
          pathname: body.pathname || "/app",
          timeZone: body.timeZone || "UTC",
          writeEnabled: access.writeEnabled,
          signal: request.signal,
          emit,
        });
      } catch {
        emit("error", { message: "The assistant could not finish. Your message was kept." });
      } finally {
        await releaseHold(access.supabase, access.context.workspaceId, "ai_brief");
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
