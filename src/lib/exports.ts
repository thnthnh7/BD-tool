"use client";

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { calculateQuoteTotals, formatVnd } from "./money";
import type { Client, CompanySettings, Quote } from "./types";

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildExportFileName(quote: Quote, client: Client | null, extension: "xlsx" | "pdf") {
  const clientPart = client?.companyName || "Khach-hang";
  const date = new Date().toISOString().slice(0, 10);
  return `Bao-gia_${safeFileName(clientPart)}_${safeFileName(quote.title)}_${date}.${extension}`;
}

async function fetchAsBase64(path: string) {
  const response = await fetch(path);
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function toArgb(hex: string, fallback = "FF2FF29E") {
  const cleaned = hex.replace("#", "").trim();
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) return `FF${cleaned.toUpperCase()}`;
  if (/^[0-9A-Fa-f]{8}$/.test(cleaned)) return cleaned.toUpperCase();
  return fallback;
}

function formatQuoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function applyMoney(cell: ExcelJS.Cell) {
  cell.numFmt = '#,##0" ₫"';
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

function thinBorder(color = "FFE5E7EB"): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = { style: "thin", color: { argb: color } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

/** Estimate Excel row height (points) for wrapped text in a fixed column width. */
function wrappedRowHeight(text: string, colWidth: number, lineHeight = 16, padding = 12) {
  const charsPerLine = Math.max(12, Math.floor(colWidth * 0.95));
  const explicitLines = text.split("\n");
  const lines = explicitLines.reduce((sum, part) => {
    return sum + Math.max(1, Math.ceil(Math.max(part.length, 1) / charsPerLine));
  }, 0);
  return Math.max(36, lines * lineHeight + padding);
}

export async function buildQuoteExcelBuffer(settings: CompanySettings, quote: Quote, client: Client | null): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.shortName;
  workbook.created = new Date();

  const mint = toArgb(settings.accentColor);
  const mintSoft = "FFE8FFF4";
  const ink = "FF222222";
  const muted = "FF888888";
  const zebra = "FFF7F7F7";
  const headerDark = "FF2A2A2A";
  const moneyFmt = '#,##0" ₫"';
  const FONT = {
    quote: 28,
    company: 14,
    client: 15,
    body: 12,
    header: 12,
    label: 11,
    muted: 10,
    desc: 11,
    totalLabel: 13,
    total: 14,
    sheetTitle: 18,
  } as const;

  const sheet = workbook.addWorksheet("Bao gia", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 22 },
  });

  const COL = { sl: 6, item: 70, price: 22, qty: 8, total: 24 } as const;

  sheet.columns = [
    { key: "sl", width: COL.sl },
    { key: "item", width: COL.item },
    { key: "price", width: COL.price },
    { key: "qty", width: COL.qty },
    { key: "total", width: COL.total },
  ];

  // —— Header ——
  sheet.getRow(1).height = 20;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 18;
  sheet.getRow(5).height = 14;

  try {
    const logo = await fetchAsBase64(settings.logoPath);
    const imageId = workbook.addImage({ base64: logo, extension: "jpeg" });
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.2 },
      ext: { width: 52, height: 52 },
    });
  } catch {
    // Logo optional — continue without blocking export
  }

  sheet.mergeCells("B1:C2");
  const companyCell = sheet.getCell("B1");
  companyCell.value = settings.companyName;
  companyCell.font = { bold: true, size: FONT.company, color: { argb: ink } };
  companyCell.alignment = { vertical: "middle", wrapText: true };

  sheet.mergeCells("B3:C3");
  sheet.getCell("B3").value = `MST: ${settings.taxCode}`;
  sheet.getCell("B3").font = { size: FONT.label, color: { argb: muted } };

  sheet.mergeCells("B4:C4");
  sheet.getCell("B4").value = settings.address;
  sheet.getCell("B4").font = { size: FONT.muted, color: { argb: muted } };
  sheet.getCell("B4").alignment = { wrapText: true };
  sheet.getRow(4).height = 32;

  sheet.mergeCells("D1:E2");
  const titleCell = sheet.getCell("D1");
  titleCell.value = "QUOTE";
  titleCell.font = { bold: true, size: FONT.quote, color: { argb: ink } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };

  sheet.getCell("D3").value = "Quote #";
  sheet.getCell("D3").font = { size: FONT.label, color: { argb: muted } };
  sheet.getCell("D3").alignment = { horizontal: "right" };
  sheet.getCell("E3").value = quote.publicId;
  sheet.getCell("E3").font = { bold: true, size: FONT.label, color: { argb: ink } };
  sheet.getCell("E3").alignment = { horizontal: "right" };

  sheet.getCell("D4").value = "Date";
  sheet.getCell("D4").font = { size: FONT.label, color: { argb: muted } };
  sheet.getCell("D4").alignment = { horizontal: "right" };
  sheet.getCell("E4").value = formatQuoteDate(quote.createdAt);
  sheet.getCell("E4").font = { bold: true, size: FONT.label, color: { argb: ink } };
  sheet.getCell("E4").alignment = { horizontal: "right" };

  // Accent underline under header
  sheet.mergeCells("A6:E6");
  sheet.getRow(6).height = 4;
  sheet.getCell("A6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: mint } };

  // —— Quote to ——
  sheet.getCell("A8").value = "Quote to:";
  sheet.getCell("A8").font = { size: FONT.label, bold: true, color: { argb: muted } };

  sheet.mergeCells("A9:C9");
  sheet.getCell("A9").value = client?.companyName || "Chưa cập nhật";
  sheet.getCell("A9").font = { bold: true, size: FONT.client, color: { argb: ink } };

  sheet.mergeCells("A10:C10");
  const contactLine = [client?.contactName, client?.email, client?.phone].filter(Boolean).join(" · ");
  sheet.getCell("A10").value = contactLine || "—";
  sheet.getCell("A10").font = { size: FONT.label, color: { argb: muted } };

  sheet.getCell("D8").value = "Project";
  sheet.getCell("D8").font = { size: FONT.label, bold: true, color: { argb: muted } };
  sheet.getCell("D8").alignment = { horizontal: "right" };
  sheet.mergeCells("E8:E9");
  sheet.getCell("E8").value = quote.title || "—";
  sheet.getCell("E8").font = { bold: true, size: FONT.body, color: { argb: ink } };
  sheet.getCell("E8").alignment = { horizontal: "right", vertical: "top", wrapText: true };

  sheet.getCell("D10").value = "Valid until";
  sheet.getCell("D10").font = { size: FONT.label, color: { argb: muted } };
  sheet.getCell("D10").alignment = { horizontal: "right" };
  sheet.getCell("E10").value = formatQuoteDate(quote.validUntil);
  sheet.getCell("E10").font = { bold: true, size: FONT.label, color: { argb: ink } };
  sheet.getCell("E10").alignment = { horizontal: "right" };

  // —— Table header ——
  const headerRowIndex = 12;
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 28;
  const headers = ["SL.", "Item Description", "Price", "Qty.", "Total"];
  headers.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, size: FONT.header, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerDark } };
    cell.alignment = {
      horizontal: index === 0 || index === 3 ? "center" : index >= 2 ? "right" : "left",
      vertical: "middle",
    };
  });

  // —— Items (Total = Price * Qty via formula) ——
  const totals = calculateQuoteTotals(quote);
  const minBodyRows = Math.max(quote.items.length, 8);
  const bodyStart = headerRowIndex + 1;
  let rowIndex = bodyStart;

  for (let i = 0; i < minBodyRows; i += 1) {
    const item = quote.items[i];
    const row = sheet.getRow(rowIndex);
    if (item) {
      const cellText = item.description ? `${item.name}\n${item.description}` : item.name;
      row.height = wrappedRowHeight(cellText, COL.item);
    } else {
      row.height = 32;
    }
    const isZebra = i % 2 === 1;

    const cells = [1, 2, 3, 4, 5].map((col) => row.getCell(col));
    cells.forEach((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isZebra ? zebra : "FFFFFFFF" },
      };
      cell.border = thinBorder();
      cell.font = { size: FONT.body, color: { argb: ink } };
      cell.alignment = { vertical: "middle" };
    });

    row.getCell(1).value = item ? i + 1 : "";
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    if (item) {
      row.getCell(2).value = {
        richText: [
          { text: item.name, font: { bold: true, size: FONT.body, color: { argb: ink } } },
          ...(item.description
            ? [{ text: `\n${item.description}`, font: { size: FONT.desc, color: { argb: muted } } }]
            : []),
        ],
      };
      row.getCell(2).alignment = { vertical: "middle", wrapText: true };
      row.getCell(3).value = item.unitPrice;
      row.getCell(4).value = item.qty;
    } else {
      // Empty editable rows — user can fill Price/Qty later
      row.getCell(3).value = null;
      row.getCell(4).value = null;
    }

    applyMoney(row.getCell(3));
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).numFmt = "0";

    // E = Price * Qty (0 when blank so SUM stays clean)
    const lineResult = item ? item.qty * item.unitPrice : 0;
    row.getCell(5).value = {
      formula: `IF(OR(C${rowIndex}="",D${rowIndex}=""),0,C${rowIndex}*D${rowIndex})`,
      result: lineResult,
    };
    applyMoney(row.getCell(5));
    row.getCell(5).font = { bold: true, size: FONT.body, color: { argb: ink } };

    rowIndex += 1;
  }

  const bodyEnd = rowIndex - 1;
  const sumRange = `E${bodyStart}:E${bodyEnd}`;

  // —— Totals with live formulas (edit % / line items in Excel) ——
  // Layout:
  //   B = editable rate (%) for Discount / Tax
  //   C = label
  //   D:E = calculated amount
  let r = bodyEnd + 2;

  // Hint
  sheet.getCell(`A${r}`).value = "Sửa Price / Qty / % bên dưới — Total & tổng tự tính bằng công thức.";
  sheet.getCell(`A${r}`).font = { size: FONT.muted, italic: true, color: { argb: muted } };
  sheet.mergeCells(`A${r}:E${r}`);
  r += 1;

  const subRow = r;
  sheet.getCell(`C${subRow}`).value = "Sub Total";
  sheet.getCell(`C${subRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`C${subRow}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.mergeCells(`D${subRow}:E${subRow}`);
  sheet.getCell(`D${subRow}`).value = { formula: `SUM(${sumRange})`, result: totals.subtotal };
  sheet.getCell(`D${subRow}`).numFmt = moneyFmt;
  sheet.getCell(`D${subRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`D${subRow}`).alignment = { horizontal: "right", vertical: "middle" };
  r += 1;

  const discRateRow = r;
  sheet.getCell(`A${discRateRow}`).value = "Discount %";
  sheet.getCell(`A${discRateRow}`).font = { size: FONT.label, color: { argb: muted } };
  sheet.getCell(`B${discRateRow}`).value = quote.discount;
  sheet.getCell(`B${discRateRow}`).numFmt = '0"%"';
  sheet.getCell(`B${discRateRow}`).font = { bold: true, size: FONT.body, color: { argb: ink } };
  sheet.getCell(`B${discRateRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`B${discRateRow}`).border = thinBorder();
  sheet.getCell(`B${discRateRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mintSoft } };
  sheet.getCell(`C${discRateRow}`).value = "Discount";
  sheet.getCell(`C${discRateRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`C${discRateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.mergeCells(`D${discRateRow}:E${discRateRow}`);
  sheet.getCell(`D${discRateRow}`).value = {
    formula: `-D${subRow}*B${discRateRow}/100`,
    result: -totals.discountAmount,
  };
  sheet.getCell(`D${discRateRow}`).numFmt = moneyFmt;
  sheet.getCell(`D${discRateRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`D${discRateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  r += 1;

  const taxRateRow = r;
  sheet.getCell(`A${taxRateRow}`).value = "Tax / VAT %";
  sheet.getCell(`A${taxRateRow}`).font = { size: FONT.label, color: { argb: muted } };
  sheet.getCell(`B${taxRateRow}`).value = quote.vatRate;
  sheet.getCell(`B${taxRateRow}`).numFmt = '0"%"';
  sheet.getCell(`B${taxRateRow}`).font = { bold: true, size: FONT.body, color: { argb: ink } };
  sheet.getCell(`B${taxRateRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`B${taxRateRow}`).border = thinBorder();
  sheet.getCell(`B${taxRateRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mintSoft } };
  sheet.getCell(`C${taxRateRow}`).value = "Tax";
  sheet.getCell(`C${taxRateRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`C${taxRateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.mergeCells(`D${taxRateRow}:E${taxRateRow}`);
  sheet.getCell(`D${taxRateRow}`).value = {
    formula: `(D${subRow}+D${discRateRow})*B${taxRateRow}/100`,
    result: totals.vatAmount,
  };
  sheet.getCell(`D${taxRateRow}`).numFmt = moneyFmt;
  sheet.getCell(`D${taxRateRow}`).font = { size: FONT.body, color: { argb: ink } };
  sheet.getCell(`D${taxRateRow}`).alignment = { horizontal: "right", vertical: "middle" };
  r += 1;

  const totalRow = r;
  sheet.getRow(totalRow).height = 30;
  sheet.getCell(`C${totalRow}`).value = "TOTAL";
  sheet.getCell(`C${totalRow}`).font = { bold: true, size: FONT.totalLabel, color: { argb: ink } };
  sheet.getCell(`C${totalRow}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(`C${totalRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mint } };
  sheet.mergeCells(`D${totalRow}:E${totalRow}`);
  sheet.getCell(`D${totalRow}`).value = {
    formula: `D${subRow}+D${discRateRow}+D${taxRateRow}`,
    result: totals.grandTotal,
  };
  sheet.getCell(`D${totalRow}`).numFmt = moneyFmt;
  sheet.getCell(`D${totalRow}`).font = { bold: true, size: FONT.total, color: { argb: ink } };
  sheet.getCell(`D${totalRow}`).alignment = { horizontal: "right", vertical: "middle" };
  sheet.getCell(`D${totalRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mint } };
  sheet.getCell(`E${totalRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mint } };

  const totalsRow = totalRow + 1;

  // —— Footer: Terms + Signature ——
  const footerStart = totalsRow + 2;
  sheet.getCell(`A${footerStart}`).value = "Terms & Conditions";
  sheet.getCell(`A${footerStart}`).font = { bold: true, size: FONT.body, color: { argb: ink } };

  settings.terms.forEach((term, index) => {
    const r = footerStart + 1 + index;
    sheet.mergeCells(`A${r}:C${r}`);
    sheet.getCell(`A${r}`).value = `${index + 1}. ${term}`;
    sheet.getCell(`A${r}`).font = { size: FONT.muted, color: { argb: muted } };
    sheet.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    sheet.getRow(r).height = 34;
  });

  const signRow = footerStart;
  sheet.getCell(`D${signRow}`).value = "Authorised Sign.";
  sheet.getCell(`D${signRow}`).font = { bold: true, size: FONT.body, color: { argb: ink } };
  sheet.getCell(`D${signRow}`).alignment = { horizontal: "right" };
  sheet.mergeCells(`D${signRow + 3}:E${signRow + 3}`);
  sheet.getCell(`D${signRow + 3}`).border = {
    bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
  };
  sheet.getCell(`D${signRow + 4}`).value = settings.shortName;
  sheet.getCell(`D${signRow + 4}`).font = { size: FONT.muted, color: { argb: muted } };
  sheet.getCell(`D${signRow + 4}`).alignment = { horizontal: "right" };

  // —— Contact bar ——
  const contactRow = footerStart + Math.max(settings.terms.length, 4) + 3;
  sheet.mergeCells(`A${contactRow}:E${contactRow}`);
  sheet.getRow(contactRow).height = 3;
  sheet.getCell(`A${contactRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mint } };

  const contactParts = [
    settings.phone ? `Phone: ${settings.phone}` : null,
    `Address: ${settings.address}`,
    settings.website ? `Website: ${settings.website}` : settings.email ? `Email: ${settings.email}` : null,
  ].filter(Boolean);

  sheet.mergeCells(`A${contactRow + 1}:E${contactRow + 1}`);
  sheet.getCell(`A${contactRow + 1}`).value = contactParts.join("   |   ");
  sheet.getCell(`A${contactRow + 1}`).font = { size: FONT.muted, color: { argb: muted } };
  sheet.getCell(`A${contactRow + 1}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getRow(contactRow + 1).height = 32;
  sheet.getCell(`A${contactRow + 1}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: mintSoft } };

  sheet.pageSetup.printArea = `A1:E${contactRow + 1}`;

  // —— Sheet 2: Deliverables (phụ lục chức năng bàn giao) ——
  const delivSheet = workbook.addWorksheet("Chuc nang ban giao", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  const DELIV_COL = {
    stt: 6,
    name: 36,
    desc: 55,
    priority: 12,
    days: 10,
    price: 22,
    notes: 22,
  } as const;

  delivSheet.columns = [
    { width: DELIV_COL.stt },
    { width: DELIV_COL.name },
    { width: DELIV_COL.desc },
    { width: DELIV_COL.priority },
    { width: DELIV_COL.days },
    { width: DELIV_COL.price },
    { width: DELIV_COL.notes },
  ];

  delivSheet.mergeCells("A1:G1");
  delivSheet.getCell("A1").value = "CÁC CHỨC NĂNG BÀN GIAO";
  delivSheet.getCell("A1").font = { bold: true, size: FONT.sheetTitle, color: { argb: ink } };
  delivSheet.getCell("A2").value = quote.title || "";
  delivSheet.getCell("A2").font = { size: FONT.body, color: { argb: muted } };
  delivSheet.getCell("A3").value = "Phụ lục scope — tổng giá trị thương mại lấy từ sheet Báo giá (modules).";
  delivSheet.getCell("A3").font = { size: FONT.muted, italic: true, color: { argb: muted } };

  const delivHeaders = ["STT", "Chức năng", "Mô tả", "Ưu tiên", "Ngày", "Giá tham chiếu", "Ghi chú"];
  const delivHeaderRow = delivSheet.getRow(5);
  delivHeaders.forEach((label, index) => {
    const cell = delivHeaderRow.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, size: FONT.header, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerDark } };
    cell.alignment = { vertical: "middle", horizontal: index === 0 || index === 3 || index === 4 ? "center" : "left" };
  });

  const deliverableRows =
    quote.deliverables?.length > 0
      ? quote.deliverables
      : quote.items.map((item) => ({
          name: item.name,
          description: item.description,
          priority: "Cao" as const,
          effortDays: 1,
          referencePrice: item.qty * item.unitPrice,
          notes: "",
        }));

  const delivStart = 6;
  const delivCount = Math.max(deliverableRows.length, 8);
  for (let i = 0; i < delivCount; i += 1) {
    const d = deliverableRows[i];
    const row = delivSheet.getRow(delivStart + i);
    const zebraFill = i % 2 === 1;
    [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
      row.getCell(col).border = thinBorder();
      row.getCell(col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: zebraFill ? zebra : "FFFFFFFF" },
      };
    });
    if (d) {
      row.getCell(1).value = i + 1;
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).value = d.name;
      row.getCell(2).alignment = { wrapText: true, vertical: "middle" };
      row.getCell(3).value = d.description;
      row.getCell(3).alignment = { wrapText: true, vertical: "middle" };
      row.getCell(4).value = d.priority;
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).value = d.effortDays ?? "";
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(6).value = d.referencePrice ?? 0;
      applyMoney(row.getCell(6));
      row.getCell(7).value = "notes" in d ? d.notes || "" : "";
      const tallest = Math.max(
        wrappedRowHeight(d.name || "", DELIV_COL.name),
        wrappedRowHeight(d.description || "", DELIV_COL.desc),
      );
      row.height = tallest;
    } else {
      row.height = 32;
    }
  }

  const delivEnd = delivStart + delivCount - 1;
  const sumDelivRow = delivEnd + 2;
  delivSheet.getCell(`E${sumDelivRow}`).value = "Tổng giá tham chiếu";
  delivSheet.getCell(`E${sumDelivRow}`).font = { bold: true, size: FONT.body };
  delivSheet.getCell(`E${sumDelivRow}`).alignment = { horizontal: "right" };
  delivSheet.getCell(`F${sumDelivRow}`).value = {
    formula: `SUM(F${delivStart}:F${delivEnd})`,
    result: deliverableRows.reduce((sum, d) => sum + (d.referencePrice || 0), 0),
  };
  applyMoney(delivSheet.getCell(`F${sumDelivRow}`));
  delivSheet.getCell(`F${sumDelivRow}`).font = { bold: true, size: FONT.body };
  delivSheet.getCell(`A${sumDelivRow + 1}`).value =
    "Lưu ý: Tổng này chỉ mang tính tham chiếu phạm vi chức năng. Tổng thanh toán lấy từ sheet Báo giá.";
  delivSheet.getCell(`A${sumDelivRow + 1}`).font = { size: FONT.muted, italic: true, color: { argb: muted } };
  delivSheet.mergeCells(`A${sumDelivRow + 1}:G${sumDelivRow + 1}`);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export async function exportQuoteToExcel(settings: CompanySettings, quote: Quote, client: Client | null) {
  const buffer = await buildQuoteExcelBuffer(settings, quote, client);
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    buildExportFileName(quote, client, "xlsx"),
  );
}

export async function exportQuoteToPdf(settings: CompanySettings, quote: Quote, client: Client | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const totals = calculateQuoteTotals(quote);
  const logo = await fetchAsBase64(settings.logoPath);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.addImage(logo, "JPEG", 48, y, 52, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(settings.companyName, 116, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`MST: ${settings.taxCode}`, 116, y + 34);
  doc.text(doc.splitTextToSize(settings.address, 380), 116, y + 50);

  y += 96;
  doc.setFillColor(settings.accentColor);
  doc.roundedRect(48, y, pageWidth - 96, 40, 8, 8, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BAO GIA DICH VU PHAT TRIEN PHAN MEM", pageWidth / 2, y + 26, { align: "center" });

  y += 72;
  doc.setFontSize(11);
  doc.text(`Khach hang: ${client?.companyName || "Chua cap nhat"}`, 48, y);
  doc.text(`Du an: ${quote.title}`, 48, y + 20);
  doc.text(`Loai du an: ${quote.projectType}`, 48, y + 40);
  doc.text(`Hieu luc den: ${quote.validUntil}`, 48, y + 60);

  y += 96;
  doc.setFont("helvetica", "bold");
  doc.text("Hang muc bao gia", 48, y);
  y += 24;

  quote.items.forEach((item, index) => {
    if (y > 690) {
      doc.addPage();
      y = 48;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${item.name}`, 48, y);
    doc.text(formatVnd(item.qty * item.unitPrice), pageWidth - 48, y, { align: "right" });
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(item.description, pageWidth - 96), 64, y);
    y += 38;
    doc.setFontSize(11);
  });

  y += 16;
  doc.setDrawColor(229, 231, 235);
  doc.line(48, y, pageWidth - 48, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.text("Tam tinh", pageWidth - 220, y);
  doc.text(formatVnd(totals.subtotal), pageWidth - 48, y, { align: "right" });
  y += 20;
  doc.text(`Chiet khau (${quote.discount}%)`, pageWidth - 220, y);
  doc.text(`-${formatVnd(totals.discountAmount)}`, pageWidth - 48, y, { align: "right" });
  y += 20;
  doc.text(`VAT (${quote.vatRate}%)`, pageWidth - 220, y);
  doc.text(formatVnd(totals.vatAmount), pageWidth - 48, y, { align: "right" });
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Tong cong", pageWidth - 220, y);
  doc.text(formatVnd(totals.grandTotal), pageWidth - 48, y, { align: "right" });

  y += 42;
  doc.setFontSize(11);
  doc.text("Dieu khoan", 48, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  settings.terms.forEach((term, index) => {
    y += 18;
    doc.text(doc.splitTextToSize(`${index + 1}. ${term}`, pageWidth - 96), 48, y);
  });

  doc.save(buildExportFileName(quote, client, "pdf"));
}
