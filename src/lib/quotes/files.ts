"use server";

import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/session";

const MAX_BYTES = 20 * 1024 * 1024;

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isDocx(file: File) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

async function storeProposalPdf(quoteId: string, file: File) {
  const context = await requireWorkspace();
  if (!quoteId) return { ok: false as const, error: "Chưa có quote." };
  if (file.size <= 0 || file.size > MAX_BYTES) return { ok: false as const, error: "File cần nhỏ hơn 20 MB." };
  if (!isPdf(file)) return { ok: false as const, error: "Proposal chỉ nhận PDF." };

  const supabase = await createClient();
  const path = `${context.workspaceId}/${quoteId}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage.from("presentations").upload(path, bytes, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) return { ok: false as const, error: error.message };

  await supabase
    .from("quotes")
    .update({ presentation_source: "upload", proposal_pdf_path: path, proposal_pdf_name: file.name })
    .eq("id", quoteId)
    .eq("workspace_id", context.workspaceId);

  const signed = await supabase.storage.from("presentations").createSignedUrl(path, 60 * 30);
  return { ok: true as const, path, name: file.name, url: signed.data?.signedUrl || "" };
}

export async function uploadProposalPdfAction(quoteId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Chọn file PDF." };
  return storeProposalPdf(quoteId, file);
}

export async function saveContractDocx(contractId: string, file: File) {
  const context = await requireWorkspace();
  if (!contractId) return { ok: false as const, error: "Chưa có hợp đồng." };
  if (file.size <= 0 || file.size > MAX_BYTES) return { ok: false as const, error: "File cần nhỏ hơn 20 MB." };
  if (!isDocx(file)) return { ok: false as const, error: "Hợp đồng chỉ nhận DOCX." };

  const supabase = await createClient();
  const path = `${context.workspaceId}/${contractId}.docx`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage.from("contracts").upload(path, bytes, {
    upsert: true,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (error) return { ok: false as const, error: error.message };

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ docx_path: path, docx_name: file.name })
    .eq("id", contractId)
    .eq("workspace_id", context.workspaceId);
  if (updateError) return { ok: false as const, error: updateError.message };

  const signed = await supabase.storage.from("contracts").createSignedUrl(path, 60 * 30);
  return { ok: true as const, path, name: file.name, url: signed.data?.signedUrl || "" };
}

export async function uploadContractDocxAction(contractId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Chọn file DOCX." };
  return saveContractDocx(contractId, file);
}

export async function quoteFileUrlAction(quoteId: string) {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("proposal_pdf_path")
    .eq("id", quoteId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!data?.proposal_pdf_path) return { error: "Chưa có file." };
  const signed = await supabase.storage.from("presentations").createSignedUrl(data.proposal_pdf_path, 60 * 30);
  if (signed.error || !signed.data?.signedUrl) return { error: signed.error?.message || "Không mở được file." };
  return { url: signed.data.signedUrl };
}

export async function contractFileUrlAction(contractId: string) {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("docx_path")
    .eq("id", contractId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!data?.docx_path) return { error: "Chưa có file." };
  const signed = await supabase.storage.from("contracts").createSignedUrl(data.docx_path, 60 * 30);
  if (signed.error || !signed.data?.signedUrl) return { error: signed.error?.message || "Không mở được hợp đồng." };
  return { url: signed.data.signedUrl };
}

export async function publicProposalPdfUrl(shareId: string) {
  if (!hasServiceRole()) return { error: "Chưa cấu hình quyền đọc file." };
  const admin = createAdminClient();
  const { data } = await admin.from("public_quotes").select("payload").eq("id", shareId).maybeSingle();
  const payload = data?.payload as { quote?: { presentationSource?: string; proposalPdfPath?: string } } | null;
  const quote = payload?.quote;
  if (quote?.presentationSource !== "upload" || !quote.proposalPdfPath) return { error: "Không có PDF." };
  const signed = await admin.storage.from("presentations").createSignedUrl(quote.proposalPdfPath, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) return { error: signed.error?.message || "Không mở được PDF." };
  return { url: signed.data.signedUrl };
}
