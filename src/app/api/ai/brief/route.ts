import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { AiBriefResult } from "@/lib/ai/types";
import { completeChat } from "@/features/ai/server/complete";
import { retrieveKnowledge, type KnowledgeEvidence } from "@/features/knowledge/server/retrieve";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
/** Vercel Hobby clamps to 60s; keep budget under that so retries still finish. */
export const maxDuration = 60;

const MAX_REQUIREMENTS_LENGTH = 20_000;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function textArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function normalizeBrief(value: unknown): AiBriefResult {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const modules = Array.isArray(source.modules) ? source.modules : [];
  const deliverables = Array.isArray(source.deliverables) ? source.deliverables : [];

  return {
    projectName: text(source.projectName, "Dự án phần mềm"),
    projectType: text(source.projectType, "Custom Software"),
    executiveSummary: text(source.executiveSummary),
    businessGoals: textArray(source.businessGoals),
    targetUsers: textArray(source.targetUsers),
    assumptions: textArray(source.assumptions),
    outOfScope: textArray(source.outOfScope),
    modules: modules
      .map((item) => {
        const moduleData = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: text(moduleData.name),
          description: text(moduleData.description),
          quantity: Math.max(1, number(moduleData.quantity, 1)),
          unitPrice: number(moduleData.unitPrice),
          pricingReason: text(moduleData.pricingReason),
        };
      })
      .filter((item) => item.name),
    deliverables: deliverables
      .map((item) => {
        const deliverable = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const rawPriority = text(deliverable.priority, "Trung");
        const priority: "Cao" | "Trung" | "Thấp" =
          rawPriority === "Cao" || rawPriority === "Thấp" ? rawPriority : "Trung";
        return {
          name: text(deliverable.name),
          description: text(deliverable.description),
          moduleName: text(deliverable.moduleName),
          priority,
          effortDays: number(deliverable.effortDays, 1),
          referencePrice: number(deliverable.referencePrice),
          acceptanceCriteria: textArray(deliverable.acceptanceCriteria),
        };
      })
      .filter((item) => item.name),
    timeline: text(source.timeline),
    recommendedTechStack: textArray(source.recommendedTechStack),
    risks: textArray(source.risks),
    clarifyingQuestions: textArray(source.clarifyingQuestions),
  };
}

function parseModelJson(content: string) {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return JSON.parse(jsonrepair(value)) as unknown;
    }
  };

  try {
    const parsed = tryParse(stripped);
    if (normalizeBrief(parsed).modules.length) return parsed;
  } catch {
    // continue to extract embedded JSON
  }

  const marker = stripped.indexOf('"modules"');
  if (marker >= 0) {
    const start = stripped.lastIndexOf("{", marker);
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return tryParse(stripped.slice(start, end + 1));
    }
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParse(stripped.slice(start, end + 1));
  }

  throw new Error("Model response is not valid JSON");
}

function compactCatalog(catalog: unknown[]) {
  return catalog.slice(0, 100).map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: text(row.name),
      suggestedPrice: number(row.suggestedPrice),
    };
  }).filter((item) => item.name);
}

function collectTextParts(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => collectTextParts(part)).join("");
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.text === "string") return row.text;
    if (typeof row.content === "string") return row.content;
    if (Array.isArray(row.content)) return collectTextParts(row.content);
  }
  return "";
}

function looksLikeBriefJson(value: string) {
  return value.includes('"modules"') || value.includes("'modules'");
}

function extractMessageContent(payload: unknown): string {
  const response = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = first.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : {};

  // Prefer content over reasoning_content — reasoning models often put prose in reasoning.
  const candidates = [
    message.content,
    message.text,
    first.text,
    first.content,
    response.output_text,
    response.content,
    response.result,
    message.reasoning_content,
  ];

  const texts = candidates.map((candidate) => collectTextParts(candidate).trim()).filter(Boolean);
  const withModules = texts.find(looksLikeBriefJson);
  if (withModules) return withModules;
  if (texts[0]) return texts[0];

  // Some gateways return the brief object directly instead of chat-completions shape.
  if (Array.isArray(response.modules)) {
    return JSON.stringify(response);
  }

  return "";
}

function describeUpstreamPayload(payload: unknown, raw: string) {
  const response = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const message = first.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : {};

  return [
    `keys=${Object.keys(response).slice(0, 8).join(",") || "none"}`,
    `choices=${choices.length}`,
    `finish=${text(first.finish_reason) || "n/a"}`,
    `msgKeys=${Object.keys(message).slice(0, 8).join(",") || "none"}`,
    `contentType=${message.content === null ? "null" : typeof message.content}`,
    `raw=${raw.replace(/\s+/g, " ").slice(0, 220)}`,
  ].join("; ");
}

// Kept for provider fallback experiments; excluded from the active routing path.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callNineRouter(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  userPrompt: string;
  useJsonObjectFormat: boolean;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  const started = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: [{ role: "user", content: params.userPrompt }],
      temperature: 0.1,
      max_tokens: 3_500,
      stream: false,
    };
    if (params.useJsonObjectFormat) {
      body.response_format = { type: "json_object" };
    }

    const upstream = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await upstream.text();
    return {
      ok: upstream.ok,
      status: upstream.status,
      raw,
      elapsedMs: Date.now() - started,
      aborted: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      status: 0,
      raw: message,
      elapsedMs: Date.now() - started,
      aborted: message.toLowerCase().includes("abort"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildUserPrompt(
  requirements: string,
  catalog: Array<{ name: string; suggestedPrice: number }>,
  evidence: KnowledgeEvidence[],
) {
  const catalogBlock =
    catalog.length > 0
      ? `\nCatalog tham khảo (không bắt buộc):\n${JSON.stringify(catalog)}`
      : "";
  const evidenceBlock = evidence.length
    ? `\nNguồn kiến thức của workspace (dùng để hiểu scope; không tự suy diễn giá):\n${evidence
        .map((item, index) => `[${index + 1}] ${item.fileName}\n${item.content}`)
        .join("\n\n")}`
    : "";

  return `Bạn là BA/solution consultant phần mềm Việt Nam.
Nhiệm vụ: phân tích yêu cầu khách và TRẢ VỀ DUY NHẤT 1 JSON object hợp lệ.

CẤM:
- Không dịch yêu cầu.
- Không viết lý luận / giải thích / markdown.
- Không viết chữ trước hoặc sau JSON.
- Output phải bắt đầu bằng { và kết thúc bằng }.

Quy tắc:
- Giá là số nguyên VND.
- modules tối đa 5 (bắt buộc có ít nhất 3).
- deliverables tối đa 8, mỗi cái map moduleName.
- priority chỉ: Cao | Trung | Thấp.
- unitPrice chỉ được dùng đúng giá của module tương ứng trong Catalog tham khảo. Nếu không có giá đã duyệt, đặt unitPrice = 0 và pricingReason bắt đầu bằng "Cần xác nhận giá".
- Không coi con số trong nguồn kiến thức là giá đã duyệt. Nguồn chỉ dùng để xác định scope và điều kiện.

Schema:
{"projectName":"","projectType":"Web App","executiveSummary":"","businessGoals":[],"targetUsers":[],"assumptions":[],"outOfScope":[],"modules":[{"name":"","description":"","quantity":1,"unitPrice":0,"pricingReason":""}],"deliverables":[{"name":"","description":"","moduleName":"","priority":"Cao","effortDays":1,"referencePrice":0,"acceptanceCriteria":[]}],"timeline":"","recommendedTechStack":[],"risks":[],"clarifyingQuestions":[]}

YÊU CẦU KHÁCH HÀNG:
${requirements}${catalogBlock}${evidenceBlock}`;
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function groundBriefPrices(brief: AiBriefResult, catalog: Array<{ name: string; suggestedPrice: number }>) {
  const approved = catalog.map((item) => ({ ...item, key: normalizedName(item.name) }));
  return {
    ...brief,
    modules: brief.modules.map((module) => {
      const key = normalizedName(module.name);
      const match = approved.find((item) => item.key === key || item.key.includes(key) || key.includes(item.key));
      return match
        ? { ...module, unitPrice: match.suggestedPrice, pricingReason: `Giá catalog đã duyệt: ${match.name}. ${module.pricingReason}`.trim() }
        : { ...module, unitPrice: 0, pricingReason: `Cần xác nhận giá. ${module.pricingReason}`.trim() };
    }),
  };
}

export async function POST(request: NextRequest) {
  let body: { requirements?: unknown; catalog?: unknown };
  try {
    body = (await request.json()) as { requirements?: unknown; catalog?: unknown };
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const requirements = text(body.requirements);
  if (!requirements) {
    return NextResponse.json({ error: "Yêu cầu khách hàng không được để trống." }, { status: 400 });
  }
  if (requirements.length > MAX_REQUIREMENTS_LENGTH) {
    return NextResponse.json({ error: `Yêu cầu tối đa ${MAX_REQUIREMENTS_LENGTH.toLocaleString("vi-VN")} ký tự.` }, { status: 400 });
  }

  const context = await requireModule("quotes");
  const supabase = await createClient();
  const { data: moduleRows } = await supabase
    .from("modules")
    .select("name, suggested_price")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  const catalog = compactCatalog(
    moduleRows?.length
      ? moduleRows.map((row) => ({ name: row.name, suggestedPrice: row.suggested_price }))
      : Array.isArray(body.catalog) ? body.catalog : [],
  );
  const evidence = await retrieveKnowledge(requirements, 6);
  const deadline = Date.now() + 52_000;
  const attempts = [
    { useJsonObjectFormat: true, includeCatalog: false },
    { useJsonObjectFormat: true, includeCatalog: catalog.length > 0 },
  ] as const;

  const attemptErrors: string[] = [];

  for (let index = 0; index < attempts.length; index += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 10_000) {
      attemptErrors.push(`attempt ${index + 1}: skipped — remaining ${remaining}ms`);
      break;
    }

    const attempt = attempts[index];
    const userPrompt = buildUserPrompt(requirements, attempt.includeCatalog ? catalog : [], evidence);
    const completion = await completeChat({
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
      maxTokens: 3_500,
      responseFormat: attempt.useJsonObjectFormat ? { type: "json_object" } : { type: "text" },
      timeoutMs: Math.min(48_000, remaining - 2_000),
      consumePlatformQuota: index === 0,
      operation: "brief",
    });

    if ("error" in completion) {
      if (completion.status === 429) {
        return NextResponse.json({ error: completion.error }, { status: 429 });
      }
      attemptErrors.push(`attempt ${index + 1}: ${completion.error}`);
      continue;
    }

    try {
      const parsed = JSON.parse(completion.data.raw) as unknown;
      const content = completion.data.content || extractMessageContent(parsed);
      if (!content) {
        attemptErrors.push(`attempt ${index + 1}: empty content — ${describeUpstreamPayload(parsed, completion.data.raw)}`);
        continue;
      }

      let brief: AiBriefResult;
      try {
        brief = groundBriefPrices(normalizeBrief(parseModelJson(content)), catalog);
      } catch {
        brief = normalizeBrief({});
      }

      if (!brief.modules.length) {
        const fallbackBrief = normalizeBrief(parsed);
        if (fallbackBrief.modules.length) {
          return NextResponse.json({
            brief: groundBriefPrices(fallbackBrief, catalog),
            meta: { attempts: index + 1, source: completion.data.source, evidence: evidence.map(({ documentId, fileName, score }) => ({ documentId, fileName, score })) },
          });
        }
        attemptErrors.push(`attempt ${index + 1}: no modules — content=${content.replace(/\s+/g, " ").slice(0, 220)}`);
        continue;
      }

      return NextResponse.json({
        brief,
        meta: { attempts: index + 1, source: completion.data.source, evidence: evidence.map(({ documentId, fileName, score }) => ({ documentId, fileName, score })) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      attemptErrors.push(`attempt ${index + 1}: parse failed — ${message} — raw=${completion.data.raw.slice(0, 180)}`);
    }
  }

  const timedOut = attemptErrors.length > 0 && attemptErrors.every((item) => item.includes("timeout"));
  return NextResponse.json(
    {
      error: timedOut
        ? "Nhà cung cấp AI phản hồi quá thời gian cho phép. Vui lòng thử lại."
        : "Không thể lấy brief hợp lệ từ nhà cung cấp AI sau nhiều lần thử.",
      details: attemptErrors.join(" | ").slice(0, 1200),
    },
    { status: 502 },
  );
}
