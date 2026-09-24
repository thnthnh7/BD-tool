import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { loadListExportRows } from "@/features/lists/server/actions";
import { admit } from "@/lib/admission";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const COLUMNS = [
  "name",
  "industry",
  "phone",
  "website",
  "address",
  "rating",
  "maps_url",
  "contact_name",
  "job_title",
  "contact_email",
  "contact_phone",
  "linkedin_url",
  "owner",
  "list_status",
] as const;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspace();
  const gate = await admit(await createClient(), session.userId, "list_export", 10, 60);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status ?? 503 });
  }

  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = await loadListExportRows(id);

  if (format === "csv") {
    const header = COLUMNS.join(",");
    const body = rows
      .map((row) => COLUMNS.map((key) => `"${String(row[key] || "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    return new NextResponse(`\uFEFF${header}\n${body}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lead-list-${id.slice(0, 8)}.csv"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lead list");
  sheet.addRow([...COLUMNS]);
  for (const row of rows) {
    sheet.addRow(COLUMNS.map((key) => row[key] || ""));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lead-list-${id.slice(0, 8)}.xlsx"`,
    },
  });
}
