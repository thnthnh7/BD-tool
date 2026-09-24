import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import type { Client, CompanySettings, Quote } from "@/lib/types";

export type DeckLayout = "cover" | "split-left" | "split-right" | "grid" | "numbered" | "stat" | "closing";

export type DeckCard = {
  title: string;
  body?: string;
  meta?: string;
};

export type DeckSlideData = {
  layout: DeckLayout;
  eyebrow: string;
  title: string;
  body?: string;
  bullets?: string[];
  cards?: DeckCard[];
  steps?: { number: string; title: string; body: string }[];
  stat?: string;
  statLabel?: string;
  indexLabel?: string;
};

export function buildDeckSlides(settings: CompanySettings, quote: Quote, client: Client | null): DeckSlideData[] {
  const totals = calculateQuoteTotals(quote);
  const slides: DeckSlideData[] = [];

  slides.push({
    layout: "cover",
    eyebrow: "Solution proposal",
    title: quote.title || "Báo giá dự án phần mềm",
    body: `Đề xuất dành cho ${client?.companyName || "khách hàng"}.`,
    bullets: [`Loại dự án: ${quote.projectType}`, `Hiệu lực đến: ${quote.validUntil}`, settings.shortName],
  });

  slides.push({
    layout: "split-left",
    indexLabel: "01",
    eyebrow: "About us",
    title: "Đối tác phát triển phần mềm cho nhu cầu thực tế",
    body: settings.about,
    bullets: [settings.companyName, `MST: ${settings.taxCode}`, settings.address],
  });

  slides.push({
    layout: "split-right",
    indexLabel: "02",
    eyebrow: "Project context",
    title: "Mục tiêu dự án",
    body:
      quote.projectOverview ||
      "Phạm vi sẽ được tinh chỉnh dựa trên mục tiêu kinh doanh, yêu cầu vận hành và feedback của khách hàng trong giai đoạn discovery.",
    bullets: quote.techStack?.slice(0, 4) || [],
  });

  if (quote.items.length) {
    const chunkSize = 6;
    for (let i = 0; i < quote.items.length; i += chunkSize) {
      const chunk = quote.items.slice(i, i + chunkSize);
      slides.push({
        layout: "grid",
        eyebrow: i === 0 ? "Commercial scope" : `Scope · phần ${Math.floor(i / chunkSize) + 1}`,
        title: i === 0 ? "Các hạng mục báo giá" : "Tiếp theo phạm vi",
        body: "Giá trị thương mại lấy từ modules. Có thể điều chỉnh trước khi chốt.",
        cards: chunk.map((item) => ({
          title: item.name,
          body: item.description,
          meta: formatVnd(item.qty * item.unitPrice),
        })),
      });
    }
  }

  if (quote.deliverables?.length) {
    const chunkSize = 6;
    for (let i = 0; i < quote.deliverables.length; i += chunkSize) {
      const chunk = quote.deliverables.slice(i, i + chunkSize);
      slides.push({
        layout: "grid",
        eyebrow: "Deliverables",
        title: i === 0 ? "Các chức năng bàn giao" : "Chức năng bàn giao (tiếp)",
        body: "Phụ lục chức năng trong sản phẩm — không thay thế tổng giá modules.",
        cards: chunk.map((item) => ({
          title: item.name,
          body: item.description,
          meta: [item.priority, item.referencePrice ? formatVnd(item.referencePrice) : null].filter(Boolean).join(" · "),
        })),
      });
    }
  }

  const steps =
    quote.paymentMilestones?.length > 0
      ? quote.paymentMilestones.map((milestone, index) => ({
          number: String(index + 1).padStart(2, "0"),
          title: `${milestone.label} · ${milestone.percent}%`,
          body: `${milestone.description} — ${milestone.trigger}`,
        }))
      : [
          { number: "01", title: "Discovery & design", body: quote.timeline || "Làm rõ scope, UI/UX và roadmap." },
          { number: "02", title: "Build & integrate", body: "Phát triển modules, tích hợp và kiểm thử nội bộ." },
          { number: "03", title: "UAT & go-live", body: "Nghiệm thu, bàn giao và hỗ trợ vận hành." },
        ];

  slides.push({
    layout: "numbered",
    eyebrow: "Timeline & payment",
    title: "Lộ trình triển khai",
    body: quote.timeline || "Tiến độ chi tiết sẽ thống nhất sau khi chốt phạm vi.",
    steps,
  });

  slides.push({
    layout: "stat",
    eyebrow: "Investment",
    title: "Tổng giá trị đề xuất",
    stat: formatVnd(totals.grandTotal),
    statLabel: "Grand total",
    body: "Dựa trên phạm vi modules hiện tại. Chiết khấu và VAT có thể điều chỉnh trên Excel.",
    bullets: [
      `Tạm tính: ${formatVnd(totals.subtotal)}`,
      `Chiết khấu: ${formatVnd(totals.discountAmount)}`,
      `VAT: ${formatVnd(totals.vatAmount)}`,
      ...(quote.paymentMilestones || []).map((milestone) => `${milestone.label}: ${milestone.percent}%`),
    ],
  });

  slides.push({
    layout: "closing",
    eyebrow: "Next steps",
    title: "Sẵn sàng bắt đầu",
    body:
      quote.nextSteps ||
      "Hai bên review phạm vi, xác nhận timeline, thống nhất thanh toán và ký hợp đồng để khởi động dự án.",
    bullets: settings.terms.slice(0, 3),
  });

  return slides;
}
