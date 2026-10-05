import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, sanitizeFileName, sniffAttachment } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";
import { stageImport } from "@/features/agent/server/jobs";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  if (!access.writeEnabled) return NextResponse.json({ error: "Imports are turned off until write actions are enabled." }, { status: 403 });
  if (access.context.memberRole === "member") return NextResponse.json({ error: "An owner or admin must run imports." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
  const mime = file.type === "text/csv" || file.name.endsWith(".csv")
    ? "text/csv"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (file.name.endsWith(".xlsm") || file.name.endsWith(".xls")) return NextResponse.json({ error: "Macros and legacy spreadsheets are blocked." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffAttachment(bytes, mime)) return NextResponse.json({ error: "The file signature does not match its type." }, { status: 400 });
  try {
    const staged = await stageImport({
      supabase: access.supabase,
      workspaceId: access.context.workspaceId,
      userId: access.context.userId,
      role: access.context.memberRole,
      locale: access.context.locale,
    }, sanitizeFileName(file.name), bytes, mime);
    return NextResponse.json(staged);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed." }, { status: 400 });
  }
}
