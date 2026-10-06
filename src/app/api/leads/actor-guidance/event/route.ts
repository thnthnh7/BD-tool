import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/features/agent/logic";
import { withWorkspace } from "@/lib/events";
import { recordActorGuidanceEvent } from "@/features/leads/server/actor-telemetry";

const CLIENT_EVENTS = new Set(["guide_opened", "example_applied", "guide_helpful"]);

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { sourceId?: string; eventType?: string; metadata?: Record<string, unknown> };
  if (!body.eventType || !CLIENT_EVENTS.has(body.eventType)) return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  const { context, supabase } = await withWorkspace();
  await recordActorGuidanceEvent({
    supabase,
    workspaceId: context.workspaceId,
    userId: context.userId,
  }, {
    sourceId: body.sourceId,
    eventType: body.eventType,
    metadata: body.metadata,
  });
  return NextResponse.json({ ok: true });
}
