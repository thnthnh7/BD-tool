import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, sanitizeFileName, sniffAttachment, wrapUntrusted } from "@/features/agent/logic";
import { loadAgentAccess } from "@/features/agent/server/access";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await loadAgentAccess();
  if (!access.enabled) return NextResponse.json({ error: "The assistant is not included in this plan." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const conversationId = String(form.get("conversationId") || "");
  if (!(file instanceof File) || !conversationId) return NextResponse.json({ error: "File is required." }, { status: 400 });
  if (file.type !== "text/plain" && file.type !== "text/csv" && !file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
    return NextResponse.json({ error: "Only text and CSV attachments are accepted in chat. Spreadsheet import uses the import action." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.name.endsWith(".csv") || file.type === "text/csv" ? "text/csv" : "text/plain";
  if (!sniffAttachment(bytes, mime) || bytes.byteLength > 200_000) return NextResponse.json({ error: "The attachment was rejected." }, { status: 400 });
  const name = sanitizeFileName(file.name);
  const id = crypto.randomUUID();
  const storagePath = `${access.context.workspaceId}/${access.context.userId}/${id}-${name}`;
  const { error: uploadError } = await access.supabase.storage.from("agent-attachments").upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) return NextResponse.json({ error: "The file could not be stored." }, { status: 500 });
  const extracted = wrapUntrusted(name, new TextDecoder().decode(bytes).slice(0, 8000));
  const { error } = await access.supabase.from("agent_attachments").insert({
    id,
    conversation_id: conversationId,
    workspace_id: access.context.workspaceId,
    user_id: access.context.userId,
    file_name: name,
    storage_path: storagePath,
    mime_type: mime,
    byte_size: bytes.byteLength,
    extracted_text: extracted,
  });
  if (error) return NextResponse.json({ error: "The file could not be saved." }, { status: 500 });
  await access.supabase.from("agent_messages").insert({
    conversation_id: conversationId,
    workspace_id: access.context.workspaceId,
    user_id: access.context.userId,
    role: "user",
    content: extracted,
  });
  return NextResponse.json({ id, fileName: name });
}
