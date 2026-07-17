import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { AiBriefResult } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 90;

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
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    return JSON.parse(jsonrepair(stripped)) as unknown;
  }
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

  const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 100) : [];
  const systemPrompt = `Bạn là Senior Business Analyst và Solution Consultant tại công ty phát triển phần mềm Việt Nam.
Nhiệm vụ: phân tích yêu cầu thô của khách hàng, tạo brief giải pháp, tự đề xuất modules thương mại và giá VND hợp lý để BD review.

Quy tắc bắt buộc:
- Chỉ trả về JSON hợp lệ, không markdown, không giải thích ngoài JSON.
- Giá phải là số nguyên VND, không dùng chuỗi tiền tệ.
- Tổng báo giá lấy từ modules. Deliverables là phụ lục chức năng, mỗi deliverable phải map về moduleName.
- Đề xuất giá độc lập dựa trên độ phức tạp, effort, rủi ro và tích hợp; catalog chỉ là dữ liệu tham khảo.
- Không bịa yêu cầu trọng yếu. Điều chưa rõ phải đưa vào assumptions hoặc clarifyingQuestions.
- Phân biệt scope và out-of-scope rõ ràng.
- priority chỉ nhận "Cao", "Trung", hoặc "Thấp".

Schema JSON:
{
  "projectName": "string",
  "projectType": "Web App | Mobile App | MVP | Internal Tool | Maintenance | Custom Software",
  "executiveSummary": "string",
  "businessGoals": ["string"],
  "targetUsers": ["string"],
  "assumptions": ["string"],
  "outOfScope": ["string"],
  "modules": [{
    "name": "string",
    "description": "string",
    "quantity": 1,
    "unitPrice": 0,
    "pricingReason": "string"
  }],
  "deliverables": [{
    "name": "string",
    "description": "string",
    "moduleName": "string",
    "priority": "Cao",
    "effortDays": 1,
    "referencePrice": 0,
    "acceptanceCriteria": ["string"]
  }],
  "timeline": "string",
  "recommendedTechStack": ["string"],
  "risks": ["string"],
  "clarifyingQuestions": ["string"]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 85_000);

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `YÊU CẦU KHÁCH HÀNG:\n${requirements}\n\nCATALOG THAM KHẢO HIỆN CÓ:\n${JSON.stringify(catalog)}`,
          },
        ],
        temperature: 0.25,
        max_tokens: 8_000,
        response_format: { type: "json_object" },
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `9Router trả lỗi ${upstream.status}.`, details: raw.slice(0, 500) },
        { status: 502 },
      );
    }

    const response = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "AI không trả nội dung brief." }, { status: 502 });
    }

    const brief = normalizeBrief(parseModelJson(content));
    if (!brief.modules.length) {
      return NextResponse.json({ error: "AI không đề xuất module hợp lệ. Hãy mô tả yêu cầu chi tiết hơn." }, { status: 422 });
    }

    return NextResponse.json({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const timeoutError = message.toLowerCase().includes("abort");
    return NextResponse.json(
      { error: timeoutError ? "9Router phản hồi quá thời gian cho phép." : "Không thể xử lý phản hồi từ 9Router.", details: message },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
