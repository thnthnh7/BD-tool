import type { Json } from "@/lib/database.types";

export type ActorFieldKind = "string" | "text" | "number" | "boolean" | "enum" | "stringList";

export type ActorField = {
  name: string;
  label: string;
  description: string;
  kind: ActorFieldKind;
  required: boolean;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
};

type SchemaProperty = {
  title?: string;
  description?: string;
  type?: string;
  editor?: string;
  default?: unknown;
  prefill?: unknown;
  enum?: unknown[];
  enumTitles?: unknown[];
  items?: { type?: string; enum?: unknown[] };
};

const SKIP_EDITORS = new Set(["proxy", "hidden", "javascript", "requestListSources", "schemaBased", "json"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function actorInputSchema(value: Json | null) {
  return asRecord(value);
}

export function readableActorFields(schema: Json | null, example: Json | null): ActorField[] {
  const root = asRecord(schema);
  const properties = asRecord(root.properties);
  const required = new Set(Array.isArray(root.required) ? root.required.filter((item): item is string => typeof item === "string") : []);
  const sample = asRecord(example);
  const fields: ActorField[] = [];

  for (const [name, raw] of Object.entries(properties)) {
    if (fields.length >= 24) break;
    const property = asRecord(raw) as SchemaProperty;
    const editor = text(property.editor);
    const title = text(property.title) || name;
    if (SKIP_EDITORS.has(editor) || /add-on/i.test(title) || title.includes("$")) continue;
    const kind = fieldKind(property, editor);
    if (!kind) continue;
    const options = kind === "enum" ? enumOptions(property) : [];
    if (kind === "enum" && options.length === 0) continue;
    fields.push({
      name,
      label: title,
      description: text(property.description).slice(0, 180),
      kind,
      required: required.has(name),
      defaultValue: defaultFor(property, sample[name], kind),
      options,
    });
  }

  return fields.sort((a, b) => Number(b.required) - Number(a.required) || 0);
}

function fieldKind(property: SchemaProperty, editor: string): ActorFieldKind | null {
  const type = text(property.type);
  if (type === "boolean") return "boolean";
  if (type === "integer" || type === "number") return "number";
  if (type === "string" && Array.isArray(property.enum)) return "enum";
  if (type === "string" && (editor === "textarea" || editor === "javascript")) return "text";
  if (type === "string") return "string";
  if (editor === "stringList" || (type === "array" && (editor === "stringList" || property.items?.type === "string"))) return "stringList";
  return null;
}

function enumOptions(property: SchemaProperty) {
  const values = (property.enum || []).map((item) => text(item)).filter(Boolean).slice(0, 300);
  const titles = Array.isArray(property.enumTitles) ? property.enumTitles.map((item) => text(item)) : [];
  return values.map((value, index) => ({ value, label: titles[index] || value }));
}

function defaultFor(property: SchemaProperty, sample: unknown, kind: ActorFieldKind) {
  const picked = sample ?? property.default ?? property.prefill;
  if (kind === "stringList" && Array.isArray(picked)) return picked.map((item) => text(item)).filter(Boolean).join("\n");
  if (kind === "boolean") return picked === true ? "on" : "";
  if (picked == null || typeof picked === "object") return "";
  return text(picked);
}

export function buildActorInput(fields: ActorField[], values: Record<string, string>) {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name] || "";
    if (field.kind === "boolean") {
      if (raw === "on") body[field.name] = true;
      continue;
    }
    if (!raw) {
      if (field.required) return { error: `Cần điền ${field.label}.` };
      continue;
    }
    if (field.kind === "number") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return { error: `${field.label} phải là số.` };
      body[field.name] = parsed;
      continue;
    }
    if (field.kind === "stringList") {
      body[field.name] = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 50);
      continue;
    }
    body[field.name] = raw.slice(0, 2000);
  }
  const summary = Object.values(body).find((value) => typeof value === "string" && value.trim());
  return { body, summary: typeof summary === "string" ? summary.slice(0, 180) : "" };
}
