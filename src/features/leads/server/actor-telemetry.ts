import "server-only";

import type { Json } from "@/lib/database.types";
import type { ReadContext } from "@/features/agent/server/read";

const ALLOWED_METADATA_KEYS = new Set(["editor", "field", "reason", "status", "staleAgeHours", "sourceType"]);

function safeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key, value]) => ALLOWED_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [key, value])) as Json;
}

export async function recordActorGuidanceEvent(ctx: Pick<ReadContext, "supabase" | "workspaceId" | "userId">, input: {
  sourceId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  await ctx.supabase.from("actor_guidance_events").insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    source_id: input.sourceId || null,
    event_type: input.eventType.slice(0, 80),
    metadata: safeMetadata(input.metadata || {}),
  });
}
