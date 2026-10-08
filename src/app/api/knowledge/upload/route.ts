import { NextRequest, NextResponse } from "next/server";
import { requireModule, requireOwnerOrAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACCEPTED_EXTENSIONS, chunkText, extractDocumentText, fileExtension, findPricingDrafts } from "@/features/knowledge/server/extract";
import { embedTexts, vectorLiteral } from "@/features/knowledge/server/embedding";
import { admit } from "@/lib/admission";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 2_000_000;
const MAX_CHUNKS = 1_200;

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-140);
}

export async function POST(request: NextRequest) {
  await requireModule("product_modules");
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const gate = await admit(supabase, context.workspaceId, "knowledge_upload", 6, 3600);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Hãy chọn một file." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "File phải nhỏ hơn 15 MB." }, { status: 400 });
  const extension = fileExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return NextResponse.json({ error: "Chỉ hỗ trợ PDF, DOCX, XLSX, CSV và TXT." }, { status: 400 });
  }
  if ((extension === "docx" || extension === "xlsx") && file.size > MAX_ARCHIVE_BYTES) {
    return NextResponse.json({ error: "File DOCX/XLSX phải nhỏ hơn 5 MB." }, { status: 400 });
  }

  const documentId = crypto.randomUUID();
  const storagePath = `${context.workspaceId}/${documentId}-${safeName(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("knowledge-files").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: insertError } = await supabase.from("knowledge_documents").insert({
    id: documentId,
    workspace_id: context.workspaceId,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    byte_size: file.size,
    status: "processing",
    created_by: context.userId,
  });
  if (insertError) {
    await supabase.storage.from("knowledge-files").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    // Recreate the File because request.formData() streams can be consumed only once on some runtimes.
    const processingFile = new File([bytes], file.name, { type: file.type });
    const text = await extractDocumentText(processingFile);
    if (text.trim().length < 20) throw new Error("Không trích xuất được đủ nội dung từ file.");
    if (text.length > MAX_EXTRACTED_CHARS) throw new Error("Tài liệu vượt quá giới hạn 2 triệu ký tự.");
    const chunks = chunkText(text);
    if (chunks.length > MAX_CHUNKS) throw new Error("Tài liệu tạo quá nhiều đoạn dữ liệu để xử lý an toàn.");
    const vectors = await embedTexts(chunks);
    for (let start = 0; start < chunks.length; start += 50) {
      const rows = chunks.slice(start, start + 50).map((content, offset) => ({
        workspace_id: context.workspaceId,
        document_id: documentId,
        chunk_index: start + offset,
        content,
        metadata: { fileName: file.name, extension },
        embedding: vectorLiteral(vectors[start + offset]),
      }));
      const { error } = await supabase.from("knowledge_chunks").insert(rows);
      if (error) throw error;
    }
    const drafts = findPricingDrafts(text).map((draft) => ({ ...draft, workspace_id: context.workspaceId, document_id: documentId }));
    if (drafts.length) {
      const { error } = await supabase.from("knowledge_module_drafts").insert(drafts);
      if (error) throw error;
    }
    await supabase.from("knowledge_documents").update({ status: "ready", extracted_chars: text.length, chunk_count: chunks.length }).eq("id", documentId);
    return NextResponse.json({ ok: true, documentId, chunks: chunks.length, drafts: drafts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xử lý được tài liệu.";
    await supabase.from("knowledge_documents").update({ status: "error", error_message: message.slice(0, 500) }).eq("id", documentId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
