import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { AiBriefResult } from "@/lib/ai/types";

export const runtime = "nodejs";
/** Vercel Hobby clamps to 60s; keep budget under that so retries still finish. */
export const maxDuration = 60;

const MAX_REQUIREMENTS_LENGTH = 20_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog = new Map<string, number[]>();

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const active = (requestLog.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  active.push(now);
  requestLog.set(ip, active);
  return active.length > MAX_REQUESTS_PER_WINDOW;
}

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
  return catalog.slice(0, 12).map((item) => {
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

function buildUserPrompt(requirements: string, catalog: Array<{ name: string; suggestedPrice: number }>) {
  const catalogBlock =
    catalog.length > 0
      ? `\nCatalog tham khảo (không bắt buộc):\n${JSON.stringify(catalog)}`
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

Schema:
{"projectName":"","projectType":"Web App","executiveSummary":"","businessGoals":[],"targetUsers":[],"assumptions":[],"outOfScope":[],"modules":[{"name":"","description":"","quantity":1,"unitPrice":0,"pricingReason":""}],"deliverables":[{"name":"","description":"","moduleName":"","priority":"Cao","effortDays":1,"referencePrice":0,"acceptanceCriteria":[]}],"timeline":"","recommendedTechStack":[],"risks":[],"clarifyingQuestions":[]}

YÊU CẦU KHÁCH HÀNG:
${requirements}${catalogBlock}`;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Đã vượt giới hạn 10 yêu cầu / 10 phút." }, { status: 429 });
  }

  const baseUrl = process.env.NINE_ROUTER_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.NINE_ROUTER_API_KEY;
  const model = process.env.NINE_ROUTER_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json({ error: "Server chưa cấu hình 9Router." }, { status: 503 });
  }

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

  const catalog = compactCatalog(Array.isArray(body.catalog) ? body.catalog : []);
  // Vercel Hobby ~60s hard limit. Prefer 1 JSON-mode call, then 1 short fallback.
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
    const userPrompt = buildUserPrompt(requirements, attempt.includeCatalog ? catalog : []);
    const result = await callNineRouter({
      baseUrl,
      apiKey,
      model,
      userPrompt,
      useJsonObjectFormat: attempt.useJsonObjectFormat,
      timeoutMs: Math.min(48_000, remaining - 2_000),
    });

    if (result.aborted) {
      attemptErrors.push(`attempt ${index + 1}: timeout after ${result.elapsedMs}ms`);
      continue;
    }

    if (!result.ok) {
      attemptErrors.push(`attempt ${index + 1}: upstream ${result.status} — ${result.raw.slice(0, 180)}`);
      continue;
    }

    try {
      const parsed = JSON.parse(result.raw) as unknown;
      const content = extractMessageContent(parsed);
      if (!content) {
        attemptErrors.push(
          `attempt ${index + 1}: empty content (${result.elapsedMs}ms) — ${describeUpstreamPayload(parsed, result.raw)}`,
        );
        continue;
      }

      let brief: AiBriefResult;
      try {
        brief = normalizeBrief(parseModelJson(content));
      } catch {
        brief = normalizeBrief({});
      }

      if (!brief.modules.length) {
        const fallbackBrief = normalizeBrief(parsed);
        if (fallbackBrief.modules.length) {
          return NextResponse.json({
            brief: fallbackBrief,
            meta: { attempts: index + 1, elapsedMs: result.elapsedMs },
          });
        }
        attemptErrors.push(
          `attempt ${index + 1}: no modules (${result.elapsedMs}ms) — content=${content.replace(/\s+/g, " ").slice(0, 220)}`,
        );
        continue;
      }

      return NextResponse.json({
        brief,
        meta: { attempts: index + 1, elapsedMs: result.elapsedMs },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      attemptErrors.push(`attempt ${index + 1}: parse failed — ${message} — raw=${result.raw.slice(0, 180)}`);
    }
  }

  const timedOut = attemptErrors.length > 0 && attemptErrors.every((item) => item.includes("timeout"));
  return NextResponse.json(
    {
      error: timedOut
        ? "9Router phản hồi quá thời gian cho phép (giới hạn ~60s trên Vercel). Thử lại hoặc kiểm tra ngrok/VPS."
        : "Không thể lấy brief hợp lệ từ 9Router sau nhiều lần thử.",
      details: attemptErrors.join(" | ").slice(0, 1200),
    },
    { status: 502 },
  );
}
