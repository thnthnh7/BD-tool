import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";
import { cancelJob, confirmImport, errorReport, jobStatus, tickImport } from "@/features/agent/server/jobs";

function ctxOf(access: Awaited<ReturnType<typeof loadAgentAccess>>) {
  return {
    supabase: access.supabase,
    workspaceId: access.context.workspaceId,
    userId: access.context.userId,
    role: access.context.memberRole,
    locale: access.context.locale,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  if (request.nextUrl.searchParams.get("errors") === "1") {
    const csv = await errorReport(ctxOf(access), id);
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"import-errors.csv\"" } });
  }
  return NextResponse.json(await jobStatus(ctxOf(access), id));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const body = await request.json() as { action?: string; mapping?: Record<string, string>; duplicatePolicy?: "skip" | "update" | "create"; listName?: string };
  const ctx = ctxOf(access);
  if (body.action === "cancel") return NextResponse.json(await cancelJob(ctx, id));
  if (body.action === "confirm") return NextResponse.json(await confirmImport(ctx, id, body.mapping || {}, body.duplicatePolicy || "skip", body.listName || ""));
  if (body.action === "tick") return NextResponse.json(await tickImport(ctx, id));
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
