"use client";

import { buildDeckSlides, type DeckSlideData } from "@/lib/deck-content";
import { canonicalDeckStyleId, DECK_PALETTES, type DeckPalette, type DeckStyleId } from "@/lib/deck-styles";
import { buildExportFileName, downloadBlob } from "@/lib/exports";
import type { Client, CompanySettings, Quote } from "@/lib/types";

const FONT = "Calibri";

function clip(value: string | undefined, max: number) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function amount(value: string | undefined) {
  return (value || "").replace(/[\s₫]+$/u, "");
}

type DeckSlide = {
  background: { color: string };
  addText: (text: string | { text: string; options: Record<string, unknown> }[], options?: Record<string, unknown>) => void;
  addShape: (shape: string, options: Record<string, unknown>) => void;
};

function paint(id: DeckStyleId, slide: DeckSlide, data: DeckSlideData, rect: string, clientName: string) {
  const palette = DECK_PALETTES[id];
  if (id === "neo-grid") return paintNeo(slide, data, palette, rect);
  if (id === "emerald") return paintEmerald(slide, data, palette, rect, clientName);
  if (id === "broadside") return paintBroadside(slide, data, palette, rect);
  if (id === "monochrome") return paintMono(slide, data, palette, rect, clientName);
  if (id === "blue") return paintBlue(slide, data, palette, rect, clientName);
  return paintSignal(slide, data, palette, rect, clientName);
}

function write(slide: DeckSlide, text: string, options: Record<string, unknown>) {
  slide.addText(text, { fontFace: FONT, margin: 0, fontSize: 16, ...options });
}

function money(slide: DeckSlide, value: string | undefined, x: number, y: number, w: number, color: string, size: number) {
  slide.addText(
    [
      { text: amount(value), options: { fontFace: FONT, fontSize: size, bold: true, color } },
      { text: " ₫", options: { fontFace: FONT, fontSize: Math.round(size * 0.42), bold: true, color } },
    ],
    { x, y, w, h: 1.1, margin: 0 },
  );
}

function paintSignal(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string, clientName: string) {
  if (data.layout === "cover") {
    slide.background = { color: palette.paper };
    slide.addShape(rect, { x: 0, y: 0, w: 4.5, h: 7.5, fill: { color: palette.bg } });
    write(slide, clientName, { x: 0.45, y: 6.2, w: 3.6, h: 0.4, fontSize: 14, color: palette.ink });
    write(slide, data.eyebrow.toUpperCase(), { x: 5.1, y: 1.5, w: 7.4, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
    slide.addShape(rect, { x: 5.1, y: 1.95, w: 0.9, h: 0.06, fill: { color: palette.accent } });
    write(slide, clip(data.title, 90), { x: 5.1, y: 2.2, w: 7.4, h: 2.2, fontSize: 32, bold: true, color: "1C1917" });
    write(slide, clip(data.body, 180), { x: 5.1, y: 4.6, w: 7, h: 1.2, fontSize: 16, color: "57534E" });
    return;
  }
  if (data.layout === "stat") {
    slide.background = { color: palette.paper };
    slide.addShape(rect, { x: 0, y: 0, w: 7.6, h: 7.5, fill: { color: palette.bg } });
    write(slide, (data.statLabel || "").toUpperCase(), { x: 0.5, y: 2.2, w: 6.5, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
    money(slide, data.stat, 0.5, 2.7, 6.6, palette.accent, 36);
    write(slide, clip(data.body, 160), { x: 0.5, y: 4.2, w: 6.4, h: 1.2, fontSize: 14, color: palette.ink });
    (data.bullets || []).slice(0, 6).forEach((item, index) => {
      write(slide, clip(item, 70), { x: 8.1, y: 1.2 + index * 0.7, w: 4.6, h: 0.5, fontSize: 14, color: "1C1917" });
    });
    return;
  }
  slide.background = { color: palette.paper };
  write(slide, data.eyebrow.toUpperCase(), { x: 0.5, y: 0.4, w: 12, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
  write(slide, clip(data.title, 90), { x: 0.5, y: 0.85, w: 12, h: 1.1, fontSize: 28, bold: true, color: "1C1917" });
  const lines = data.cards?.map((card) => `${card.title}    ${card.meta || ""}`) || data.bullets || data.steps?.map((step) => `${step.number}  ${step.title}`) || [];
  lines.slice(0, 8).forEach((item, index) => {
    write(slide, clip(item, 110), { x: 0.5, y: 2.2 + index * 0.55, w: 12.2, h: 0.45, fontSize: 15, color: "1C1917" });
  });
}

function paintNeo(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string) {
  slide.background = { color: palette.bg };
  if (data.layout === "cover") {
    slide.addShape(rect, { x: 0, y: 0, w: 13.33, h: 4.35, fill: { color: palette.accent } });
    write(slide, clip(data.title, 80), { x: 0.5, y: 1.5, w: 12.2, h: 2.2, fontSize: 40, bold: true, color: palette.ink });
    (data.bullets || []).slice(0, 3).forEach((item, index) => {
      const x = 0.15 + index * 4.4;
      slide.addShape(rect, { x, y: 4.5, w: 4.25, h: 2.7, fill: { color: palette.paper }, line: { color: palette.ink, width: 1.5 } });
      write(slide, clip(item, 60), { x: x + 0.2, y: 5.3, w: 3.8, h: 1.2, fontSize: 14, bold: true, color: palette.ink });
    });
    return;
  }
  if (data.layout === "stat") {
    slide.addShape(rect, { x: 0.3, y: 0.3, w: 12.7, h: 3.6, fill: { color: palette.accent }, line: { color: palette.ink, width: 1.5 } });
    write(slide, (data.statLabel || "").toUpperCase(), { x: 0.6, y: 0.55, w: 6, h: 0.3, fontSize: 12, bold: true, color: palette.ink });
    money(slide, data.stat, 0.6, 1.2, 8, palette.ink, 40);
    (data.bullets || []).slice(0, 4).forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.3 + col * 6.5;
      const y = 4.15 + row * 1.5;
      slide.addShape(rect, { x, y, w: 6.3, h: 1.35, fill: { color: palette.paper }, line: { color: palette.ink, width: 1.5 } });
      write(slide, clip(item, 50), { x: x + 0.2, y: y + 0.4, w: 5.9, h: 0.5, fontSize: 14, bold: true, color: palette.ink });
    });
    return;
  }
  if (data.layout === "closing") {
    slide.background = { color: palette.ink };
    slide.addShape(rect, { x: 0.5, y: 0.5, w: 1.5, h: 0.7, fill: { color: palette.accent } });
    write(slide, "NEXT", { x: 0.5, y: 0.62, w: 1.5, h: 0.45, fontSize: 14, bold: true, align: "center", color: palette.ink });
    write(slide, clip(data.title, 60), { x: 0.5, y: 3.2, w: 12, h: 2, fontSize: 40, bold: true, color: palette.paper });
    return;
  }
  const cells = data.cards?.slice(0, 6) || [];
  if (cells.length) {
    cells.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.3 + col * 4.3;
      const y = 0.4 + row * 3.4;
      slide.addShape(rect, { x, y, w: 4.1, h: 3.2, fill: { color: palette.paper }, line: { color: palette.ink, width: 1.5 } });
      write(slide, clip(card.title, 40), { x: x + 0.2, y: y + 0.25, w: 3.7, h: 0.8, fontSize: 16, bold: true, color: palette.ink });
      write(slide, clip(card.body, 80), { x: x + 0.2, y: y + 1.15, w: 3.7, h: 1, fontSize: 12, color: palette.muted });
      slide.addShape(rect, { x, y: y + 2.45, w: 4.1, h: 0.75, fill: { color: palette.accent } });
      write(slide, clip(card.meta, 28), { x: x + 0.2, y: y + 2.6, w: 3.7, h: 0.4, fontSize: 13, bold: true, color: palette.ink });
    });
    return;
  }
  write(slide, clip(data.title, 70), { x: 0.4, y: 0.35, w: 12, h: 0.8, fontSize: 26, bold: true, color: palette.ink });
  const lines = data.bullets || data.steps?.map((step) => `${step.number}  ${step.title}`) || [];
  lines.slice(0, 4).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.3 + col * 6.5;
    const y = 1.6 + row * 2.6;
    slide.addShape(rect, { x, y, w: 6.3, h: 2.4, fill: { color: index === 0 ? palette.accent : palette.paper }, line: { color: palette.ink, width: 1.5 } });
    write(slide, clip(item, 80), { x: x + 0.25, y: y + 0.7, w: 5.8, h: 1, fontSize: 16, bold: true, color: palette.ink });
  });
}

function paintEmerald(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string, clientName: string) {
  if (data.layout === "cover") {
    slide.background = { color: palette.bg };
    slide.addShape(rect, { x: 0.55, y: 0.4, w: 12.2, h: 0.04, fill: { color: palette.ink } });
    slide.addShape(rect, { x: 0.55, y: 0.52, w: 12.2, h: 0.015, fill: { color: palette.ink } });
    write(slide, "PROPOSAL", { x: 0.55, y: 0.7, w: 6, h: 0.3, fontSize: 12, bold: true, color: palette.ink });
    write(slide, clip(data.title, 80), { x: 0.55, y: 2.3, w: 12, h: 2.2, fontSize: 36, bold: true, color: palette.ink });
    slide.addShape(rect, { x: 0.55, y: 5.5, w: 4.6, h: 1.4, fill: { color: palette.paper } });
    write(slide, clientName, { x: 0.75, y: 5.95, w: 4.2, h: 0.5, fontSize: 16, bold: true, color: palette.ink });
    return;
  }
  if (data.layout === "stat") {
    slide.background = { color: palette.bg };
    write(slide, (data.statLabel || "").toUpperCase(), { x: 0.6, y: 2, w: 8, h: 0.3, fontSize: 12, bold: true, color: palette.ink });
    money(slide, data.stat, 0.6, 2.5, 12, palette.ink, 42);
    return;
  }
  if (data.layout === "grid") {
    slide.background = { color: palette.ink };
    write(slide, clip(data.title, 60), { x: 0.5, y: 0.35, w: 12, h: 0.7, fontSize: 26, bold: true, color: palette.paper });
    (data.cards || []).slice(0, 6).forEach((card, index) => {
      const y = 1.3 + index * 0.9;
      write(slide, String(index + 1).padStart(2, "0"), { x: 0.5, y, w: 0.8, h: 0.5, fontSize: 18, bold: true, color: palette.bg });
      write(slide, clip(card.title, 40), { x: 1.5, y, w: 7.5, h: 0.4, fontSize: 16, bold: true, color: palette.paper });
      write(slide, clip(card.meta, 24), { x: 9.4, y, w: 3.3, h: 0.4, fontSize: 14, align: "right", color: palette.bg });
    });
    return;
  }
  slide.background = { color: data.layout === "closing" ? palette.ink : palette.bg };
  const ink = data.layout === "closing" ? palette.paper : palette.ink;
  write(slide, clip(data.title, 70), { x: 0.55, y: 0.5, w: 8, h: 1.4, fontSize: 28, bold: true, color: ink });
  write(slide, clip(data.body, 220), { x: 0.55, y: 2.1, w: 7.6, h: 2.2, fontSize: 15, color: ink });
  const notes = data.bullets || data.steps?.map((step) => `${step.number}  ${step.title}`) || [];
  if (notes.length && data.layout !== "closing") {
    slide.addShape(rect, { x: 8.6, y: 0.5, w: 4.2, h: 6.4, fill: { color: palette.paper } });
    notes.slice(0, 6).forEach((item, index) => {
      write(slide, clip(item, 40), { x: 8.85, y: 0.8 + index * 0.9, w: 3.7, h: 0.7, fontSize: 13, color: palette.ink });
    });
  }
}

function paintBroadside(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string) {
  if (data.layout === "stat") {
    slide.background = { color: palette.accent };
    write(slide, (data.statLabel || "").toUpperCase(), { x: 0.55, y: 2.1, w: 8, h: 0.3, fontSize: 13, bold: true, color: palette.bg });
    money(slide, data.stat, 0.55, 2.6, 12, palette.bg, 44);
    return;
  }
  if (data.layout === "closing") {
    slide.background = { color: palette.bg };
    const words = data.title.split(" ");
    const last = words.pop() || "";
    write(slide, words.join(" ").toUpperCase(), { x: 0.5, y: 3.4, w: 12.2, h: 1.2, fontSize: 32, bold: true, color: palette.ink });
    write(slide, last.toUpperCase(), { x: 0.5, y: 4.7, w: 12.2, h: 1.1, fontSize: 36, bold: true, color: palette.accent });
    return;
  }
  slide.background = { color: palette.bg };
  write(slide, data.eyebrow.toUpperCase(), { x: 0.5, y: 0.35, w: 8, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
  write(slide, clip(data.title, 70).toUpperCase(), { x: 0.5, y: 0.75, w: 12.2, h: 1.6, fontSize: data.layout === "cover" ? 40 : 28, bold: true, color: palette.ink });
  if (data.layout === "cover") return;
  const lines = data.cards?.map((card) => `${card.title} — ${card.meta || ""}`) || data.bullets || data.steps?.map((step) => step.title) || [];
  lines.slice(0, 3).forEach((item, index) => {
    const x = 0.5 + index * 4.2;
    slide.addShape(rect, { x, y: 3.1, w: 0.7, h: 0.06, fill: { color: palette.accent } });
    write(slide, clip(item, 70), { x, y: 3.4, w: 3.9, h: 2.4, fontSize: 14, color: palette.ink });
  });
}

function paintMono(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string, clientName: string) {
  slide.background = { color: palette.bg };
  slide.addShape(rect, { x: 0.5, y: 0.35, w: 12.3, h: 0.03, fill: { color: palette.ink } });
  if (data.layout === "cover") {
    write(slide, data.eyebrow.toUpperCase(), { x: 0.5, y: 0.55, w: 8, h: 0.3, fontSize: 12, bold: true, color: palette.ink });
    write(slide, clip(data.title, 90), { x: 0.5, y: 1.4, w: 12, h: 1.8, fontSize: 32, bold: true, color: palette.ink });
    write(slide, "KHÁCH", { x: 0.5, y: 5.4, w: 2, h: 0.3, fontSize: 11, bold: true, color: palette.ink });
    write(slide, clientName, { x: 2.6, y: 5.4, w: 8, h: 0.3, fontSize: 14, color: palette.ink });
    return;
  }
  if (data.layout === "stat") {
    write(slide, clip(data.title, 50).toUpperCase(), { x: 0.5, y: 0.55, w: 12, h: 0.4, fontSize: 14, bold: true, color: palette.ink });
    (data.bullets || []).slice(0, 5).forEach((item, index) => {
      write(slide, clip(item, 80), { x: 0.5, y: 1.4 + index * 0.55, w: 12, h: 0.4, fontSize: 16, color: palette.ink });
    });
    const y = 1.4 + (data.bullets?.slice(0, 5).length || 0) * 0.55 + 0.2;
    slide.addShape(rect, { x: 0.5, y, w: 12.3, h: 0.03, fill: { color: palette.ink } });
    slide.addShape(rect, { x: 0.5, y: y + 0.08, w: 12.3, h: 0.015, fill: { color: palette.ink } });
    money(slide, data.stat, 0.5, y + 0.3, 8, palette.ink, 32);
    return;
  }
  write(slide, clip(data.title, 80), { x: 0.5, y: 0.55, w: 12, h: 0.8, fontSize: 26, bold: true, color: palette.ink });
  const lines = data.cards?.map((card, index) => `${String(index + 1).padStart(2, "0")}   ${card.title}    ${card.meta || ""}`) || data.bullets || data.steps?.map((step) => `${step.number}   ${step.title}`) || [];
  lines.slice(0, 8).forEach((item, index) => {
    write(slide, clip(item, 100), { x: 0.5, y: 1.7 + index * 0.6, w: 12.2, h: 0.45, fontSize: 15, color: palette.ink });
  });
}

function paintBlue(slide: DeckSlide, data: DeckSlideData, palette: DeckPalette, rect: string, clientName: string) {
  slide.background = { color: palette.bg };
  if (data.layout === "cover") {
    write(slide, clip(data.title, 80), { x: 0.55, y: 1.4, w: 7.4, h: 2.2, fontSize: 32, bold: true, color: palette.ink });
    slide.addShape(rect, { x: 8.5, y: 4.3, w: 4.3, h: 2.5, fill: { color: palette.accent } });
    write(slide, "PREPARED FOR", { x: 8.75, y: 4.5, w: 3.9, h: 0.3, fontSize: 11, bold: true, color: palette.accentInk });
    write(slide, clientName, { x: 8.75, y: 5, w: 3.9, h: 0.8, fontSize: 18, bold: true, color: palette.accentInk });
    return;
  }
  if (data.layout === "stat") {
    slide.addShape(rect, { x: 0, y: 0, w: 13.33, h: 3.1, fill: { color: palette.accent } });
    write(slide, (data.statLabel || "").toUpperCase(), { x: 0.55, y: 0.45, w: 8, h: 0.3, fontSize: 12, bold: true, color: palette.accentInk });
    money(slide, data.stat, 0.55, 1, 10, palette.accentInk, 36);
    (data.bullets || []).slice(0, 5).forEach((item, index) => {
      write(slide, clip(item, 70), { x: 0.55, y: 3.5 + index * 0.65, w: 12, h: 0.45, fontSize: 16, color: palette.ink });
    });
    return;
  }
  if (data.layout === "closing") {
    slide.addShape(rect, { x: 0.45, y: 0.45, w: 12.4, h: 6.6, fill: { color: palette.bg }, line: { color: palette.accent, width: 1.75 } });
    write(slide, clip(data.title, 70), { x: 0.9, y: 2.2, w: 11, h: 1.4, fontSize: 32, bold: true, color: palette.ink });
    write(slide, clip(data.body, 180), { x: 0.9, y: 3.8, w: 10.5, h: 1.4, fontSize: 16, color: palette.muted });
    return;
  }
  write(slide, data.eyebrow.toUpperCase(), { x: 0.5, y: 0.35, w: 8, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
  write(slide, clip(data.title, 70), { x: 0.5, y: 0.75, w: 12, h: 0.8, fontSize: 26, bold: true, color: palette.ink });
  const cards = data.cards?.slice(0, 4) || [];
  if (cards.length) {
    cards.forEach((card, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.45 + col * 6.4;
      const y = 1.9 + row * 2.5;
      slide.addShape(rect, { x, y, w: 6.1, h: 2.3, fill: { color: palette.paper }, line: { color: palette.line, width: 1 } });
      write(slide, String(index + 1).padStart(2, "0"), { x: x + 0.25, y: y + 0.2, w: 1, h: 0.3, fontSize: 12, bold: true, color: palette.accent });
      write(slide, clip(card.title, 40), { x: x + 0.25, y: y + 0.6, w: 5.5, h: 0.5, fontSize: 16, bold: true, color: palette.ink });
      write(slide, clip(card.meta, 28), { x: x + 0.25, y: y + 1.5, w: 5.5, h: 0.4, fontSize: 13, bold: true, color: palette.accent });
    });
    return;
  }
  write(slide, clip(data.body, 240), { x: 0.5, y: 1.8, w: 7, h: 2, fontSize: 15, color: palette.muted });
  const notes = data.bullets || data.steps?.map((step) => `${step.number}  ${step.title}`) || [];
  notes.slice(0, 4).forEach((item, index) => {
    slide.addShape(rect, { x: 8, y: 1.8 + index * 1.2, w: 4.7, h: 1.05, fill: { color: palette.paper }, line: { color: palette.line, width: 1 } });
    write(slide, clip(item, 40), { x: 8.2, y: 2.05 + index * 1.2, w: 4.3, h: 0.55, fontSize: 13, color: palette.ink });
  });
}

export async function exportQuoteToPptx(settings: CompanySettings, quote: Quote, client: Client | null) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = quote.title || "Proposal";
  pptx.author = settings.companyName;
  pptx.company = settings.companyName;
  const styleId = canonicalDeckStyleId(quote.deckStyle);
  const rect = pptx.ShapeType.rect;
  const clientName = clip(client?.companyName || "Khách hàng", 40);
  for (const data of buildDeckSlides(settings, quote, client)) {
    const slide = pptx.addSlide();
    paint(styleId, slide as unknown as DeckSlide, data, rect, clientName);
  }
  const file = await pptx.write({ outputType: "blob" });
  const bytes = file instanceof Blob ? file : file instanceof Uint8Array ? new Uint8Array(file) : typeof file === "string" ? new TextEncoder().encode(file) : new Uint8Array(file);
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  downloadBlob(blob, buildExportFileName(quote, client, "pptx"));
}
