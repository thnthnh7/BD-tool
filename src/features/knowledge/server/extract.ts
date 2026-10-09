import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";
import { assertSafeZip } from "@/lib/zip-safety";

export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "xlsx", "csv", "txt"] as const;

export function fileExtension(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

export async function extractDocumentText(file: File) {
  const extension = fileExtension(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (extension === "txt" || extension === "csv") return new TextDecoder().decode(arrayBuffer);
  if (extension === "docx") {
    assertSafeZip(bytes, { maxEntries: 2_000, maxUncompressedBytes: 50_000_000, maxEntryBytes: 20_000_000, maxCompressionRatio: 100 });
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return result.value;
  }
  if (extension === "xlsx") {
    assertSafeZip(bytes, { maxEntries: 2_000, maxUncompressedBytes: 50_000_000, maxEntryBytes: 20_000_000, maxCompressionRatio: 100 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const rows: string[] = [];
    workbook.eachSheet((sheet) => {
      rows.push(`# Sheet: ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map((value) => String(value ?? "")).join(" | "));
      });
    });
    return rows.join("\n");
  }
  if (extension === "pdf") {
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d) {
      throw new Error("The uploaded file is not a valid PDF.");
    }
    const result = await extractPdfText(bytes, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  }
  throw new Error("Định dạng file chưa được hỗ trợ.");
}

export function chunkText(text: string, maxChars = 1800, overlap = 240) {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    let end = Math.min(cursor + maxChars, clean.length);
    if (end < clean.length) {
      const boundary = Math.max(clean.lastIndexOf("\n", end), clean.lastIndexOf(". ", end));
      if (boundary > cursor + maxChars * 0.55) end = boundary + 1;
    }
    const chunk = clean.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    cursor = Math.max(cursor + 1, end - overlap);
  }
  return chunks;
}

export function findPricingDrafts(text: string) {
  const results: Array<{ name: string; description: string; suggested_price: number; source_excerpt: string }> = [];
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const money = /(?:VND|VNĐ|₫|đ)?\s*([0-9][0-9.,\s]{3,})(?:\s*(?:VND|VNĐ|₫|đ))?/i;
  for (const line of lines) {
    const match = line.match(money);
    if (!match || line.length > 320) continue;
    const amount = Number(match[1].replace(/[^0-9]/g, ""));
    if (!Number.isFinite(amount) || amount < 10_000) continue;
    const name = line.slice(0, match.index).replace(/[|:\-–—]+$/g, "").trim();
    if (name.length < 3 || name.length > 120) continue;
    results.push({ name, description: "Trích xuất từ tài liệu; cần kiểm tra trước khi duyệt.", suggested_price: amount, source_excerpt: line });
    if (results.length >= 40) break;
  }
  return results;
}
