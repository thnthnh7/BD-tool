"use client";

import { AlertCircle, Check, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import type { AiBriefResult } from "@/lib/ai/types";
import { formatVnd } from "@/lib/money";
import type { ServiceModule } from "@/lib/types";

type AiBriefAssistantProps = {
  catalog: ServiceModule[];
  onApply: (brief: AiBriefResult) => void;
};

export function AiBriefAssistant({ catalog, onApply }: AiBriefAssistantProps) {
  const [requirements, setRequirements] = useState("");
  const [brief, setBrief] = useState<AiBriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  async function generateBrief() {
    if (!requirements.trim() || loading) return;
    setLoading(true);
    setError("");
    setApplied(false);

    try {
      const response = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements,
          catalog: catalog.slice(0, 12).map((module) => ({
            name: module.name,
            suggestedPrice: module.suggestedPrice,
          })),
        }),
      });
      const data = (await response.json()) as { brief?: AiBriefResult; error?: string; details?: string };
      if (!response.ok || !data.brief) {
        throw new Error([data.error, data.details].filter(Boolean).join(" "));
      }
      setBrief(data.brief);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo brief.");
    } finally {
      setLoading(false);
    }
  }

  const total = brief?.modules.reduce((sum, module) => sum + module.quantity * module.unitPrice, 0) || 0;

  return (
    <section className="rounded-[2rem] border border-[#2FF29E]/40 bg-[linear-gradient(135deg,#f7fffb,#ffffff)] p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#2FF29E] p-3 text-black">
          <Sparkles size={22} />
        </div>
        <div>
          <h2 className="text-xl font-black">AI Solution Brief</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Paste yêu cầu thô của khách. AI sẽ đề xuất brief, modules, giá và chức năng bàn giao để bạn review.
          </p>
        </div>
      </div>

      <textarea
        value={requirements}
        onChange={(event) => setRequirements(event.target.value)}
        className="mt-5 min-h-40 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-zinc-900"
        placeholder="Ví dụ: Khách cần web app quản lý booking cho 3 chi nhánh nhà hàng, có sơ đồ bàn, dashboard quản lý tổng, thông báo trùng lịch..."
        maxLength={20_000}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
        <span>AI tự đề xuất giá VND; catalog hiện tại chỉ dùng tham khảo.</span>
        <span>{requirements.length.toLocaleString("vi-VN")} / 20.000</span>
      </div>

      <button
        type="button"
        onClick={generateBrief}
        disabled={!requirements.trim() || loading}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
        {loading ? "Đang gọi 9Router (có thể 30–60 giây)..." : "Tạo brief & báo giá bằng AI"}
      </button>

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {brief ? (
        <div className="mt-6 space-y-5 border-t border-zinc-200 pt-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">AI brief — cần review</p>
              <h3 className="mt-2 text-2xl font-black">{brief.projectName}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{brief.executiveSummary}</p>
            </div>
            <div className="rounded-2xl bg-zinc-950 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Giá AI đề xuất</p>
              <p className="mt-2 text-2xl font-black text-[#2FF29E]">{formatVnd(total)}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black">Modules thương mại ({brief.modules.length})</p>
            <div className="grid gap-3 md:grid-cols-2">
              {brief.modules.map((module, index) => (
                <article key={`${module.name}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-black">{module.name}</h4>
                    <strong className="shrink-0 text-sm">{formatVnd(module.quantity * module.unitPrice)}</strong>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{module.description}</p>
                  {module.pricingReason ? (
                    <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                      Lý do giá: {module.pricingReason}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <BriefList title={`Chức năng bàn giao (${brief.deliverables.length})`} items={brief.deliverables.map((item) => item.name)} />
            <BriefList title="Giả định" items={brief.assumptions} />
            <BriefList title="Ngoài phạm vi" items={brief.outOfScope} />
            <BriefList title="Rủi ro" items={brief.risks} />
          </div>

          {brief.clarifyingQuestions.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-900">Câu hỏi cần xác nhận với khách</p>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {brief.clarifyingQuestions.map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onApply(brief);
                setApplied(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2FF29E] px-5 py-3 text-sm font-black text-black hover:bg-[#25d98b]"
            >
              <Check size={18} />
              Áp dụng vào báo giá
            </button>
            <span className="text-xs text-zinc-500">
              {applied ? "Đã áp dụng — tiếp tục Step 2 để sửa giá/modules." : "Thao tác này điền modules, deliverables, timeline và tech stack."}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="font-black">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
          {items.slice(0, 10).map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">Không có đề xuất.</p>
      )}
    </div>
  );
}
