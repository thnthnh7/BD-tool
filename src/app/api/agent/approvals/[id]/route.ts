import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";
import { executeApprovedWrite } from "@/features/agent/server/writes";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  if (!access.writeEnabled) return NextResponse.json({ error: "Write actions are turned off for this workspace." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json() as { decision?: "approve" | "cancel" };
  if (body.decision === "cancel") {
    await access.supabase.from("agent_approvals").update({ status: "canceled" }).eq("id", id).eq("workspace_id", access.context.workspaceId).eq("user_id", access.context.userId).eq("status", "waiting_for_confirmation");
    return NextResponse.json({ status: "canceled" });
  }
  const result = await executeApprovedWrite({
    supabase: access.supabase,
    workspaceId: access.context.workspaceId,
    userId: access.context.userId,
    role: access.context.memberRole,
    locale: access.context.locale,
  }, id);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
