import "server-only";

import ExcelJS from "exceljs";
import type { Json } from "@/lib/database.types";
import { guardSpreadsheetCell, parseCsv, suggestMapping, validateImportRow, type ImportRow } from "@/features/agent/logic";
import type { ReadContext } from "@/features/agent/server/read";
import { assertSafeZip } from "@/lib/zip-safety";

export const IMPORT_LIMITS = { maxBytes: 2_000_000, maxRows: 2_000, maxColumns: 40, batch: 25 };

export async function stageImport(ctx: ReadContext, fileName: string, bytes: Uint8Array, mime: string) {
  if (bytes.byteLength > IMPORT_LIMITS.maxBytes) throw new Error("The file is larger than the beta import limit.");
  const matrix = mime.includes("sheet") ? await readSheet(bytes) : parseCsv(new TextDecoder().decode(bytes));
  if (matrix.length > IMPORT_LIMITS.maxRows) throw new Error("The file has more rows than the beta import limit.");
  const headers = Object.keys(matrix[0] || {});
  if (headers.length > IMPORT_LIMITS.maxColumns) throw new Error("The file has too many columns.");
  const mapping = suggestMapping(headers);
  const { data: job, error } = await ctx.supabase.from("agent_jobs").insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    kind: "import",
    status: "waiting",
    file_name: fileName,
    mapping,
    plan_snapshot: { headers, sample: matrix.slice(0, 5), limits: IMPORT_LIMITS },
  }).select("id, mapping, plan_snapshot").single();
  if (error || !job) throw new Error("The import could not be staged.");
  const rows = matrix.map((raw, index) => ({ job_id: job.id, workspace_id: ctx.workspaceId, row_number: index + 2, raw: raw as Json }));
  for (let index = 0; index < rows.length; index += 200) {
    const { error: rowError } = await ctx.supabase.from("agent_import_rows").insert(rows.slice(index, index + 200));
    if (rowError) throw new Error("The import rows could not be stored.");
  }
  return { jobId: job.id, headers, mapping, sample: matrix.slice(0, 5), rowCount: matrix.length };
}

async function readSheet(bytes: Uint8Array) {
  assertSafeZip(bytes, { maxEntries: 500, maxUncompressedBytes: 10_000_000, maxEntryBytes: 5_000_000, maxCompressionRatio: 100 });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  if (workbook.worksheets.length > 5) throw new Error("The workbook has too many sheets.");
  const headerRow = sheet.getRow(1);
  const headers = (headerRow.values as ExcelJS.CellValue[]).slice(1).map((value) => String(value || "").trim());
  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: ImportRow = {};
    headers.forEach((header, index) => {
      if (header) record[header] = String(row.getCell(index + 1).text || "").trim();
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  return rows;
}

export async function confirmImport(ctx: ReadContext, jobId: string, mapping: Record<string, string>, duplicatePolicy: "skip" | "update" | "create", listName: string) {
  const { data: job } = await ctx.supabase.from("agent_jobs").select("id, status, plan_snapshot").eq("id", jobId).eq("workspace_id", ctx.workspaceId).eq("user_id", ctx.userId).maybeSingle();
  if (!job || job.status !== "waiting") return { error: "This import is not waiting for confirmation." };
  const { error } = await ctx.supabase.from("agent_jobs").update({
    status: "queued",
    mapping,
    duplicate_policy: duplicatePolicy,
    list_name: listName,
    plan_snapshot: { ...(job.plan_snapshot as object), confirmedMapping: mapping, duplicatePolicy },
  }).eq("id", jobId).eq("workspace_id", ctx.workspaceId).eq("status", "waiting");
  if (error) return { error: "The import could not be confirmed." };
  return { ok: true as const };
}

export async function tickImport(ctx: ReadContext, jobId: string) {
  const { data: job } = await ctx.supabase.from("agent_jobs").select("id, status, mapping, duplicate_policy, list_name, plan_snapshot").eq("id", jobId).eq("workspace_id", ctx.workspaceId).eq("user_id", ctx.userId).maybeSingle();
  if (!job) return { error: "Import not found." };
  if (job.status === "canceled" || job.status === "completed" || job.status === "failed") return jobStatus(ctx, jobId);
  if (job.status === "waiting") return { error: "Confirm the mapping before the import runs." };
  await ctx.supabase.from("agent_jobs").update({ status: "running" }).eq("id", jobId).eq("workspace_id", ctx.workspaceId);
  const { data: rows } = await ctx.supabase.from("agent_import_rows").select("id, row_number, raw").eq("job_id", jobId).eq("status", "queued").order("row_number").limit(IMPORT_LIMITS.batch);
  const mapping = job.mapping as Record<string, string>;
  let listId = typeof (job.plan_snapshot as { listId?: string }).listId === "string" ? (job.plan_snapshot as { listId: string }).listId : "";
  if (job.list_name && !listId) {
    const { data: list } = await ctx.supabase.from("lead_lists").insert({ workspace_id: ctx.workspaceId, name: job.list_name, owner_user_id: ctx.userId }).select("id").single();
    listId = list?.id || "";
    if (listId) await ctx.supabase.from("agent_jobs").update({ plan_snapshot: { ...(job.plan_snapshot as object), listId } }).eq("id", jobId).eq("workspace_id", ctx.workspaceId);
  }
  for (const row of rows || []) {
    const raw = row.raw as ImportRow;
    const errors = validateImportRow(raw, mapping);
    if (errors.length) {
      await ctx.supabase.from("agent_import_rows").update({ status: "failed", error_message: errors.join(" ") }).eq("id", row.id).eq("workspace_id", ctx.workspaceId);
      continue;
    }
    const email = mapping.email ? raw[mapping.email] || "" : "";
    const name = mapping.name ? raw[mapping.name] || "" : email;
    const existing = email
      ? await ctx.supabase.from("contacts").select("id").eq("workspace_id", ctx.workspaceId).ilike("email", email).limit(1).maybeSingle()
      : { data: null };
    if (existing.data && job.duplicate_policy === "skip") {
      await ctx.supabase.from("agent_import_rows").update({ status: "skipped", record_id: existing.data.id }).eq("id", row.id).eq("workspace_id", ctx.workspaceId);
      continue;
    }
    let companyId: string | null = null;
    const companyName = mapping.company ? raw[mapping.company] || "" : "";
    if (companyName) {
      const found = await ctx.supabase.from("companies").select("id").eq("workspace_id", ctx.workspaceId).ilike("name", companyName).limit(1).maybeSingle();
      if (found.data) companyId = found.data.id;
      else {
        const created = await ctx.supabase.from("companies").insert({ workspace_id: ctx.workspaceId, name: companyName, owner_user_id: ctx.userId }).select("id").single();
        companyId = created.data?.id || null;
      }
    }
    if (existing.data && job.duplicate_policy === "update") {
      await ctx.supabase.from("contacts").update({ display_name: name, phone: mapping.phone ? raw[mapping.phone] || "" : undefined, company_id: companyId }).eq("id", existing.data.id).eq("workspace_id", ctx.workspaceId);
      await ctx.supabase.from("agent_import_rows").update({ status: "updated", record_id: existing.data.id }).eq("id", row.id).eq("workspace_id", ctx.workspaceId);
      if (listId && companyId) await ctx.supabase.from("lead_list_members").insert({ workspace_id: ctx.workspaceId, list_id: listId, company_id: companyId, contact_id: existing.data.id });
      continue;
    }
    const created = await ctx.supabase.from("contacts").insert({
      workspace_id: ctx.workspaceId,
      display_name: name,
      email,
      phone: mapping.phone ? raw[mapping.phone] || "" : "",
      job_title: mapping.jobTitle ? raw[mapping.jobTitle] || "" : "",
      linkedin_url: mapping.linkedin ? raw[mapping.linkedin] || "" : "",
      notes: mapping.notes ? raw[mapping.notes] || "" : "",
      company_id: companyId,
      owner_user_id: ctx.userId,
    }).select("id").single();
    if (!created.data) {
      await ctx.supabase.from("agent_import_rows").update({ status: "failed", error_message: "Contact was not created." }).eq("id", row.id).eq("workspace_id", ctx.workspaceId);
      continue;
    }
    await ctx.supabase.from("agent_import_rows").update({ status: "created", record_id: created.data.id }).eq("id", row.id).eq("workspace_id", ctx.workspaceId);
    if (listId && companyId) await ctx.supabase.from("lead_list_members").insert({ workspace_id: ctx.workspaceId, list_id: listId, company_id: companyId, contact_id: created.data.id });
  }
  return jobStatus(ctx, jobId);
}

export async function jobStatus(ctx: ReadContext, jobId: string) {
  const { data: rows } = await ctx.supabase.from("agent_import_rows").select("status").eq("job_id", jobId).eq("workspace_id", ctx.workspaceId);
  const counts = { total: rows?.length || 0, queued: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const row of rows || []) {
    if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
  }
  const done = counts.queued === 0;
  const status = done ? (counts.failed && (counts.created || counts.updated) ? "partially_completed" : counts.failed && !counts.created ? "failed" : "completed") : "running";
  await ctx.supabase.from("agent_jobs").update({ status, counts, cursor_row: counts.total - counts.queued }).eq("id", jobId).eq("workspace_id", ctx.workspaceId).neq("status", "canceled");
  return { status, counts };
}

export async function cancelJob(ctx: ReadContext, jobId: string) {
  await ctx.supabase.from("agent_jobs").update({ status: "canceled" }).eq("id", jobId).eq("workspace_id", ctx.workspaceId).eq("user_id", ctx.userId).in("status", ["waiting", "queued", "running"]);
  return { status: "canceled" };
}

export async function errorReport(ctx: ReadContext, jobId: string) {
  const { data } = await ctx.supabase.from("agent_import_rows").select("row_number, raw, error_message, status").eq("job_id", jobId).eq("workspace_id", ctx.workspaceId).eq("status", "failed").order("row_number");
  const lines = [["row", "error", "raw"].map(guardSpreadsheetCell).join(",")];
  for (const row of data || []) {
    lines.push([row.row_number, row.error_message, JSON.stringify(row.raw)].map(guardSpreadsheetCell).join(","));
  }
  return lines.join("\r\n");
}
