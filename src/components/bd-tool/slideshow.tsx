"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { exportQuoteToExcel, exportQuoteToPdf } from "@/lib/exports";
import { clientInitials } from "@/lib/image";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import type { Client, CompanySettings, Quote } from "@/lib/types";

type SlideshowProps = {
  settings: CompanySettings;
  quote: Quote;
  client: Client | null;
  allowExport?: boolean;
};

type SlideLayout = "cover" | "split-left" | "split-right" | "grid" | "numbered" | "stat" | "closing";

type SlideCard = {
  title: string;
  body?: string;
  meta?: string;
};

type Slide = {
  layout: SlideLayout;
  theme: "dark" | "light";
  eyebrow: string;
  title: string;
  body?: string;
  bullets?: string[];
  cards?: SlideCard[];
  steps?: { number: string; title: string; body: string }[];
  stat?: string;
  statLabel?: string;
  indexLabel?: string;
};

function BrandMark({
  settings,
  client,
  size = 48,
}: {
  settings: CompanySettings;
  client: Client | null;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Image src={settings.logoPath} alt={settings.shortName} width={size} height={size} className="rounded-xl object-cover" />
      <span className="text-lg font-black opacity-40">×</span>
      {client?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={client.logoUrl}
          alt={client.companyName}
          width={size}
          height={size}
          className="rounded-xl bg-white object-contain p-1"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl font-black text-black"
          style={{ width: size, height: size, backgroundColor: settings.accentColor, fontSize: size * 0.28 }}
        >
          {clientInitials(client?.companyName || "KH")}
        </div>
      )}
    </div>
  );
}

function buildSlides(settings: CompanySettings, quote: Quote, client: Client | null): Slide[] {
  const totals = calculateQuoteTotals(quote);
  const slides: Slide[] = [];

  slides.push({
    layout: "cover",
    theme: "dark",
    eyebrow: "Solution proposal",
    title: quote.title || "Báo giá dự án phần mềm",
    body: `Đề xuất dành cho ${client?.companyName || "khách hàng"}.`,
    bullets: [`Loại dự án: ${quote.projectType}`, `Hiệu lực đến: ${quote.validUntil}`, settings.shortName],
  });

  slides.push({
    layout: "split-left",
    theme: "dark",
    indexLabel: "01",
    eyebrow: "About us",
    title: "Đối tác phát triển phần mềm cho nhu cầu thực tế",
    body: settings.about,
    bullets: [settings.companyName, `MST: ${settings.taxCode}`, settings.address],
  });

  slides.push({
    layout: "split-right",
    theme: "light",
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
        theme: i % 2 === 0 ? "dark" : "light",
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
        theme: "light",
        eyebrow: "Deliverables",
        title: i === 0 ? "Các chức năng bàn giao" : "Chức năng bàn giao (tiếp)",
        body: "Phụ lục chức năng trong sản phẩm — không thay thế tổng giá modules.",
        cards: chunk.map((d) => ({
          title: d.name,
          body: d.description,
          meta: [d.priority, d.referencePrice ? formatVnd(d.referencePrice) : null].filter(Boolean).join(" · "),
        })),
      });
    }
  }

  const steps =
    quote.paymentMilestones?.length > 0
      ? quote.paymentMilestones.map((m, index) => ({
          number: String(index + 1).padStart(2, "0"),
          title: `${m.label} · ${m.percent}%`,
          body: `${m.description} — ${m.trigger}`,
        }))
      : [
          { number: "01", title: "Discovery & design", body: quote.timeline || "Làm rõ scope, UI/UX và roadmap." },
          { number: "02", title: "Build & integrate", body: "Phát triển modules, tích hợp và kiểm thử nội bộ." },
          { number: "03", title: "UAT & go-live", body: "Nghiệm thu, bàn giao và hỗ trợ vận hành." },
        ];

  slides.push({
    layout: "numbered",
    theme: "dark",
    eyebrow: "Timeline & payment",
    title: "Lộ trình triển khai",
    body: quote.timeline || "Tiến độ chi tiết sẽ thống nhất sau khi chốt phạm vi.",
    steps,
  });

  slides.push({
    layout: "stat",
    theme: "dark",
    eyebrow: "Investment",
    title: "Tổng giá trị đề xuất",
    stat: formatVnd(totals.grandTotal),
    statLabel: "Grand total",
    body: "Dựa trên phạm vi modules hiện tại. Chiết khấu và VAT có thể điều chỉnh trên Excel.",
    bullets: [
      `Tạm tính: ${formatVnd(totals.subtotal)}`,
      `Chiết khấu: ${formatVnd(totals.discountAmount)}`,
      `VAT: ${formatVnd(totals.vatAmount)}`,
      ...(quote.paymentMilestones || []).map((m) => `${m.label}: ${m.percent}%`),
    ],
  });

  slides.push({
    layout: "closing",
    theme: "light",
    eyebrow: "Next steps",
    title: "Sẵn sàng bắt đầu",
    body:
      quote.nextSteps ||
      "Hai bên review phạm vi, xác nhận timeline, thống nhất thanh toán và ký hợp đồng để khởi động dự án.",
    bullets: settings.terms.slice(0, 3),
  });

  return slides;
}

function SlideShell({
  theme,
  accent,
  children,
}: {
  theme: "dark" | "light";
  accent: string;
  children: React.ReactNode;
}) {
  const dark = theme === "dark";
  return (
    <div
      className={`relative min-h-[540px] overflow-hidden p-8 md:p-12 ${dark ? "text-white" : "text-zinc-950"}`}
      style={
        dark
          ? {
              background: `radial-gradient(circle at top right, ${accent}55, transparent 34%), linear-gradient(135deg, #050505, #171717)`,
            }
          : {
              background: `linear-gradient(180deg, #fafafa 0%, #f3f4f6 100%)`,
            }
      }
    >
      {/* geometric accent block like reference */}
      <div
        className="pointer-events-none absolute -right-16 top-24 h-64 w-48 rotate-6 opacity-20 md:h-80 md:w-64"
        style={{ backgroundColor: accent }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-20 h-40 w-40 -rotate-12 opacity-10"
        style={{ backgroundColor: accent }}
      />
      {children}
    </div>
  );
}

function CoverSlide({ slide, settings, client }: { slide: Slide; settings: CompanySettings; client: Client | null }) {
  return (
    <div className="grid min-h-[460px] gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
      <div>
        <BrandMark settings={settings} client={client} size={56} />
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: settings.accentColor }}>
          {slide.eyebrow}
        </p>
        <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">{slide.title}</h2>
        <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">{slide.body}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {slide.bullets?.map((b) => (
            <span key={b} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80">
              {b}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-4 translate-x-3 translate-y-3 rounded-[2rem]" style={{ backgroundColor: settings.accentColor }} />
        <div className="relative rounded-[2rem] border border-white/10 bg-white p-8 text-black">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Prepared for</p>
          <p className="mt-4 text-3xl font-black leading-tight">{client?.companyName || "Khách hàng"}</p>
          <div className="mt-10 h-1.5 w-24 rounded-full" style={{ backgroundColor: settings.accentColor }} />
          <p className="mt-6 text-sm text-zinc-500">{quoteLine(settings, client)}</p>
        </div>
      </div>
    </div>
  );
}

function quoteLine(settings: CompanySettings, client: Client | null) {
  return `${settings.shortName}${client ? ` × ${client.companyName}` : ""}`;
}

function SplitSlide({
  slide,
  settings,
  side,
  theme,
}: {
  slide: Slide;
  settings: CompanySettings;
  side: "left" | "right";
  theme: "dark" | "light";
}) {
  const mintBlock = (
    <div className="flex min-h-[320px] flex-col justify-between rounded-[2rem] p-8 text-black" style={{ backgroundColor: settings.accentColor }}>
      <p className="text-6xl font-black opacity-40 md:text-8xl">{slide.indexLabel || "01"}</p>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em]">{slide.eyebrow}</p>
        <p className="mt-3 text-2xl font-black leading-snug">{slide.title.slice(0, 48)}{slide.title.length > 48 ? "…" : ""}</p>
      </div>
    </div>
  );

  const content = (
    <div>
      <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${theme === "dark" ? "text-white/50" : "text-zinc-400"}`}>
        {slide.eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{slide.title}</h2>
      {slide.body ? <p className={`mt-5 text-base leading-7 md:text-lg ${theme === "dark" ? "text-white/70" : "text-zinc-600"}`}>{slide.body}</p> : null}
      {slide.bullets?.length ? (
        <div className="mt-8 space-y-3">
          {slide.bullets.map((b) => (
            <div
              key={b}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                theme === "dark" ? "border-white/10 bg-white/5 text-white/80" : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {b}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="grid min-h-[420px] gap-8 md:grid-cols-2 md:items-center">
      {side === "left" ? (
        <>
          {mintBlock}
          {content}
        </>
      ) : (
        <>
          {content}
          {mintBlock}
        </>
      )}
    </div>
  );
}

function GridSlide({ slide, theme, accent }: { slide: Slide; theme: "dark" | "light"; accent: string }) {
  return (
    <div>
      <p className={`text-sm font-semibold uppercase tracking-[0.3em]`} style={{ color: accent }}>
        {slide.eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{slide.title}</h2>
      {slide.body ? <p className={`mt-4 max-w-3xl text-base ${theme === "dark" ? "text-white/65" : "text-zinc-600"}`}>{slide.body}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slide.cards?.map((card) => (
          <div
            key={card.title + (card.meta || "")}
            className={`rounded-3xl border p-5 ${
              theme === "dark" ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white shadow-sm"
            }`}
          >
            <div className="mb-4 h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
            <h3 className="text-lg font-black leading-snug">{card.title}</h3>
            {card.body ? <p className={`mt-2 line-clamp-3 text-sm leading-6 ${theme === "dark" ? "text-white/60" : "text-zinc-500"}`}>{card.body}</p> : null}
            {card.meta ? (
              <p className="mt-4 text-sm font-bold" style={{ color: theme === "dark" ? accent : "#111" }}>
                {card.meta}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberedSlide({ slide, theme, accent }: { slide: Slide; theme: "dark" | "light"; accent: string }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: accent }}>
        {slide.eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{slide.title}</h2>
      {slide.body ? <p className={`mt-4 max-w-2xl ${theme === "dark" ? "text-white/65" : "text-zinc-600"}`}>{slide.body}</p> : null}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {slide.steps?.map((step) => (
          <div
            key={step.number}
            className={`rounded-3xl border p-6 ${theme === "dark" ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"}`}
          >
            <div className="inline-flex rounded-2xl px-3 py-2 text-2xl font-black text-black" style={{ backgroundColor: accent }}>
              {step.number}
            </div>
            <h3 className="mt-5 text-xl font-black">{step.title}</h3>
            <p className={`mt-3 text-sm leading-6 ${theme === "dark" ? "text-white/65" : "text-zinc-500"}`}>{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatSlide({ slide, accent }: { slide: Slide; accent: string }) {
  return (
    <div className="grid min-h-[420px] items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: accent }}>
          {slide.eyebrow}
        </p>
        <p className="mt-3 text-lg font-semibold text-white/50">{slide.statLabel}</p>
        <h2 className="mt-2 text-5xl font-black tracking-tight md:text-7xl" style={{ color: accent }}>
          {slide.stat}
        </h2>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/70">{slide.body}</p>
      </div>
      <div className="space-y-3">
        {slide.bullets?.map((b) => (
          <div key={b} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
            {b}
          </div>
        ))}
        {slide.bullets?.some((b) => b.includes("%")) ? (
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: "70%", backgroundColor: accent }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClosingSlide({
  slide,
  settings,
  client,
}: {
  slide: Slide;
  settings: CompanySettings;
  client: Client | null;
}) {
  return (
    <div className="flex min-h-[420px] flex-col justify-between">
      <div>
        <BrandMark settings={settings} client={client} size={52} />
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: settings.accentColor }}>
          {slide.eyebrow}
        </p>
        <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{slide.title}</h2>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">{slide.body}</p>
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {slide.bullets?.map((b) => (
          <div key={b} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">
            {b}
          </div>
        ))}
      </div>
      <div className="mt-8 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-black" style={{ backgroundColor: settings.accentColor }}>
        Xuất Excel / PDF từ thanh công cụ phía trên
      </div>
    </div>
  );
}

function renderSlide(slide: Slide, settings: CompanySettings, client: Client | null) {
  switch (slide.layout) {
    case "cover":
      return <CoverSlide slide={slide} settings={settings} client={client} />;
    case "split-left":
      return <SplitSlide slide={slide} settings={settings} side="left" theme={slide.theme} />;
    case "split-right":
      return <SplitSlide slide={slide} settings={settings} side="right" theme={slide.theme} />;
    case "grid":
      return <GridSlide slide={slide} theme={slide.theme} accent={settings.accentColor} />;
    case "numbered":
      return <NumberedSlide slide={slide} theme={slide.theme} accent={settings.accentColor} />;
    case "stat":
      return <StatSlide slide={slide} accent={settings.accentColor} />;
    case "closing":
      return <ClosingSlide slide={slide} settings={settings} client={client} />;
    default:
      return null;
  }
}

export function Slideshow({ settings, quote, client, allowExport = true }: SlideshowProps) {
  const [active, setActive] = useState(0);
  const slides = useMemo(() => buildSlides(settings, quote, client), [client, quote, settings]);
  const safeActive = Math.min(active, Math.max(0, slides.length - 1));
  const slide = slides[safeActive] || slides[0];

  if (!slide) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-black text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <BrandMark settings={settings} client={client} size={34} />
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-[0.24em] text-white/50">Presentation</p>
            <p className="text-sm font-semibold">{client?.companyName || settings.shortName}</p>
          </div>
        </div>
        {allowExport ? (
          <div className="flex gap-2">
            <button
              onClick={() => exportQuoteToExcel(settings, quote, client)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button
              onClick={() => exportQuoteToPdf(settings, quote, client)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <Download size={14} />
              PDF
            </button>
          </div>
        ) : null}
      </div>

      <SlideShell theme={slide.theme} accent={settings.accentColor}>
        {renderSlide(slide, settings, client)}

        <div className="absolute bottom-6 left-8 right-8 z-10 flex items-center justify-between">
          <button
            onClick={() => setActive((value) => Math.max(0, value - 1))}
            disabled={safeActive === 0}
            className={`rounded-full p-3 disabled:opacity-30 ${slide.theme === "dark" ? "bg-white/10 text-white" : "bg-zinc-900/10 text-zinc-900"}`}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            {slides.map((item, index) => (
              <button
                key={`${item.layout}-${item.title}-${index}`}
                onClick={() => setActive(index)}
                className="h-2 rounded-full transition-all"
                style={{
                  width: index === safeActive ? 30 : 8,
                  backgroundColor:
                    index === safeActive ? settings.accentColor : slide.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)",
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setActive((value) => Math.min(slides.length - 1, value + 1))}
            disabled={safeActive === slides.length - 1}
            className={`rounded-full p-3 disabled:opacity-30 ${slide.theme === "dark" ? "bg-white/10 text-white" : "bg-zinc-900/10 text-zinc-900"}`}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </SlideShell>
    </section>
  );
}
