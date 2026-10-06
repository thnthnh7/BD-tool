import type { Json } from "@/lib/database.types";
import { actorInputGuide, readableActorFields } from "@/features/leads/actor-input";

export const ACTOR_GUIDE_PROMPT_VERSION = "actor-guide-v1";

export function readableActorMarkdown(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 — $2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/```[^\n]*\n?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type StructuredActorGuide = {
  summary: string;
  quickStart: string[];
  inputModes: Array<{ name: string; when: string; fields: string[] }>;
  fieldHints: Array<{ field: string; label: string; hint: string; required: boolean; source: "schema" }>;
  examples: Json[];
  limitations: string[];
  sourceAnchors: Array<{ source: "schema" | "readme"; anchor: string }>;
  confidence: "high" | "medium" | "low";
  missingInformation: string[];
};

export function structuredActorGuide(input: {
  schema: Json | null;
  example: Json | null;
  readmeMarkdown: string;
  locale: string;
}): StructuredActorGuide {
  const root = actorInputGuide(input.schema);
  const fields = readableActorFields(input.schema, null);
  const readme = readableActorMarkdown(input.readmeMarkdown);
  const urlFields = fields.filter((field) => field.kind === "urlList" || /url/i.test(field.name));
  const filterFields = fields.filter((field) => !urlFields.some((urlField) => urlField.name === field.name));
  const vi = input.locale.toLowerCase().startsWith("vi");
  const inputModes = [
    ...(urlFields.length ? [{
      name: vi ? "URL tìm kiếm" : "Search URLs",
      when: vi ? "Dùng khi bạn đã có URL tìm kiếm đầy đủ." : "Use when you already have complete search URLs.",
      fields: urlFields.map((field) => field.name),
    }] : []),
    ...(filterFields.length ? [{
      name: vi ? "Bộ lọc" : "Filters",
      when: vi ? "Dùng khi muốn cấu hình tìm kiếm từ các trường riêng." : "Use when configuring the search from individual fields.",
      fields: filterFields.map((field) => field.name),
    }] : []),
  ];
  const missingInformation = [
    ...(!readme ? [vi ? "Actor không công bố README cho default build." : "The Actor does not publish a README for its default build."] : []),
    ...(!root.description ? [vi ? "Input schema không có mô tả tổng quan." : "The input schema has no root description."] : []),
  ];
  return {
    summary: root.description || readme.slice(0, 700) || (vi ? "Không có mô tả Actor." : "No Actor description is available."),
    quickStart: [
      vi ? "Chọn một chế độ input phù hợp." : "Choose the appropriate input mode.",
      vi ? "Chỉ điền tập trường tối thiểu cần thiết." : "Fill only the smallest required field set.",
      vi ? "Kiểm tra preview trước khi xác nhận lượt chạy tính phí." : "Validate the preview before confirming a billable run.",
    ],
    inputModes,
    fieldHints: fields.map((field) => ({
      field: field.name,
      label: field.label,
      hint: field.description || (vi ? "Không có mô tả field trong schema." : "No field description is published in the schema."),
      required: field.required,
      source: "schema" as const,
    })),
    examples: input.example ? [input.example] : [],
    limitations: missingInformation,
    sourceAnchors: [
      ...fields.map((field) => ({ source: "schema" as const, anchor: `properties.${field.name}` })),
      ...(readme ? [{ source: "readme" as const, anchor: "default-build-readme" }] : []),
    ],
    confidence: root.description && fields.length ? (readme ? "high" : "medium") : "low",
    missingInformation,
  };
}
