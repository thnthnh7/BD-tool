import type { Json } from "@/lib/database.types";

export type ActorFieldKind = "string" | "text" | "date" | "number" | "boolean" | "enum" | "multiEnum" | "stringTags" | "stringList" | "urlList" | "json";

export type ActorField = {
  name: string;
  label: string;
  description: string;
  kind: ActorFieldKind;
  editor: string;
  required: boolean;
  defaultValue: string;
  schemaDefaultValue: string;
  prefillValue: string;
  exampleValue: string;
  options: Array<{ value: string; label: string }>;
  suggestions: Array<{ value: string; label: string }>;
  sectionCaption: string;
  sectionDescription: string;
  minimum: number | null;
  maximum: number | null;
  minLength: number | null;
  maxLength: number | null;
  minItems: number | null;
  maxItems: number | null;
  pattern: string;
  unit: string;
  secret: boolean;
  nullable: boolean;
  advanced: boolean;
  dateType: string;
  uniqueItems: boolean;
  rawSchema: Json;
};

export type UnsupportedActorField = { name: string; label: string; editor: string; type: string; required: boolean; reason: string };

type SchemaProperty = {
  title?: string; description?: string; type?: string; editor?: string; default?: unknown; prefill?: unknown; example?: unknown;
  enum?: unknown[]; enumTitles?: unknown[]; enumSuggestedValues?: unknown[];
  items?: { type?: string; enum?: unknown[]; enumTitles?: unknown[]; enumSuggestedValues?: unknown[] };
  sectionCaption?: string; sectionDescription?: string; groupCaption?: string; groupDescription?: string;
  minimum?: number; maximum?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number;
  pattern?: string; unit?: string; isSecret?: boolean; dateType?: string; uniqueItems?: boolean;
  nullable?: boolean; isAdvanced?: boolean; order?: number;
};

const MAX_FIELDS = 80;
const UNSUPPORTED_EDITORS = new Set(["proxy", "hidden", "javascript", "python", "resourcePicker", "fileupload"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function actorInputSchema(value: Json | null) {
  return asRecord(value);
}

export function actorInputGuide(schema: Json | null) {
  const root = asRecord(schema);
  return { title: text(root.title), description: text(root.description).slice(0, 5000) };
}

function requiredNames(root: Record<string, unknown>) {
  return new Set(Array.isArray(root.required) ? root.required.filter((item): item is string => typeof item === "string") : []);
}

export function readableActorFields(schema: Json | null, example: Json | null): ActorField[] {
  const root = asRecord(schema);
  const properties = asRecord(root.properties);
  const required = requiredNames(root);
  const sample = asRecord(example);
  const fields: ActorField[] = [];
  const propertyOrder = Array.isArray(root.propertyOrder)
    ? root.propertyOrder.filter((item): item is string => typeof item === "string")
    : [];
  const entries = Object.entries(properties).sort(([leftName, left], [rightName, right]) => {
    const leftExplicit = propertyOrder.indexOf(leftName);
    const rightExplicit = propertyOrder.indexOf(rightName);
    if (leftExplicit !== -1 || rightExplicit !== -1) {
      if (leftExplicit === -1) return 1;
      if (rightExplicit === -1) return -1;
      return leftExplicit - rightExplicit;
    }
    const leftOrder = finite(asRecord(left).order);
    const rightOrder = finite(asRecord(right).order);
    return leftOrder != null && rightOrder != null ? leftOrder - rightOrder : 0;
  });
  for (const [name, raw] of entries) {
    if (fields.length >= MAX_FIELDS) break;
    const property = asRecord(raw) as SchemaProperty;
    const editor = text(property.editor);
    const title = text(property.title) || name;
    if (property.isSecret === true || UNSUPPORTED_EDITORS.has(editor)) continue;
    const kind = fieldKind(property, editor);
    if (!kind) continue;
    const options = kind === "enum" ? enumOptions(property.enum, property.enumTitles) : kind === "multiEnum" ? enumOptions(property.items?.enum, property.items?.enumTitles) : [];
    if (kind === "enum" && options.length === 0) continue;
    fields.push({
      name, label: title, description: text(property.description).slice(0, 1600), kind, editor,
      required: required.has(name),
      defaultValue: submittedDefaultFor(property, sample[name], kind),
      schemaDefaultValue: formatValue(property.default, kind),
      prefillValue: formatValue(property.prefill, kind),
      exampleValue: exampleFor(property, kind), options,
      suggestions: enumOptions(property.enumSuggestedValues || property.items?.enumSuggestedValues, property.enumTitles || property.items?.enumTitles),
      sectionCaption: text(property.sectionCaption || property.groupCaption),
      sectionDescription: text(property.sectionDescription || property.groupDescription).slice(0, 1200),
      minimum: finite(property.minimum), maximum: finite(property.maximum), minLength: finite(property.minLength), maxLength: finite(property.maxLength),
      minItems: finite(property.minItems), maxItems: finite(property.maxItems), pattern: text(property.pattern), unit: text(property.unit), secret: false,
      dateType: text(property.dateType) || "absolute", uniqueItems: property.uniqueItems === true,
      nullable: property.nullable === true,
      advanced: property.isAdvanced === true || /advanced/i.test(text(property.sectionCaption || property.groupCaption)),
      rawSchema: JSON.parse(JSON.stringify(property)) as Json,
    });
  }
  return fields;
}

export function unsupportedActorFields(schema: Json | null): UnsupportedActorField[] {
  const root = asRecord(schema);
  const properties = asRecord(root.properties);
  const required = requiredNames(root);
  const unsupported: UnsupportedActorField[] = [];
  for (const [index, [name, raw]] of Object.entries(properties).entries()) {
    const property = asRecord(raw) as SchemaProperty;
    const editor = text(property.editor);
    const label = text(property.title) || name;
    const overflow = index >= MAX_FIELDS;
    if (overflow || !fieldKind(property, editor) || property.isSecret === true || UNSUPPORTED_EDITORS.has(editor)) unsupported.push({
      name, label, editor, type: text(property.type), required: required.has(name),
      reason: overflow
        ? `This Actor publishes more than ${MAX_FIELDS} fields; use validated JSON mode for this field.`
        : property.isSecret === true
          ? "Secret input must not be stored in a scrape job."
          : editor
            ? `Unsupported Apify editor: ${editor}`
            : `Unsupported input type: ${text(property.type) || "unknown"}`,
    });
  }
  return unsupported;
}

export function actorSecretFieldNames(schema: Json | null) {
  const properties = asRecord(asRecord(schema).properties);
  return Object.entries(properties).filter(([, raw]) => asRecord(raw).isSecret === true).map(([name]) => name);
}

function fieldKind(property: SchemaProperty, editor: string): ActorFieldKind | null {
  const type = text(property.type);
  if (type === "boolean") return "boolean";
  if (type === "integer" || type === "number") return "number";
  if (type === "string" && Array.isArray(property.enum)) return "enum";
  if (type === "string" && editor === "datepicker") return "date";
  if (type === "string" && editor === "textarea") return "text";
  if (type === "string") return "string";
  if (type === "array" && editor === "requestListSources") return "urlList";
  if (type === "array" && editor === "select" && Array.isArray(property.items?.enum)) return "multiEnum";
  if (type === "array" && editor === "select" && Array.isArray(property.items?.enumSuggestedValues)) return "stringTags";
  if (editor === "stringList" || (type === "array" && property.items?.type === "string")) return "stringList";
  if (type === "object" || type === "array") return "json";
  return null;
}

function enumOptions(values: unknown[] | undefined, rawTitles: unknown[] | undefined) {
  const normalized = (values || []).map((item) => text(item)).filter(Boolean).slice(0, 300);
  const titles = Array.isArray(rawTitles) ? rawTitles.map((item) => text(item)) : [];
  return normalized.map((value, index) => ({ value, label: titles[index] || value }));
}

function formatValue(value: unknown, kind: ActorFieldKind) {
  if (kind === "urlList" && Array.isArray(value)) return value.map((item) => text(asRecord(item).url || item)).filter(Boolean).join("\n");
  if ((kind === "stringList" || kind === "multiEnum" || kind === "stringTags") && Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join("\n");
  if (kind === "json" && value != null && typeof value === "object") return JSON.stringify(value, null, 2);
  if (kind === "boolean") return value === true ? "on" : "";
  if (value == null || typeof value === "object") return "";
  return text(value);
}

function submittedDefaultFor(property: SchemaProperty, sample: unknown, kind: ActorFieldKind) {
  return formatValue(sample ?? property.default ?? property.prefill, kind);
}

function exampleFor(property: SchemaProperty, kind: ActorFieldKind) {
  return formatValue(property.example, kind).slice(0, 500);
}

function listValues(raw: string, maxItems: number | null) {
  const limit = Math.min(500, Math.max(1, maxItems || 50));
  return raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

function validateText(field: ActorField, raw: string) {
  if (field.minLength != null && raw.length < field.minLength) return `${field.label} must contain at least ${field.minLength} characters.`;
  if (field.maxLength != null && raw.length > field.maxLength) return `${field.label} must contain at most ${field.maxLength} characters.`;
  if (field.pattern) {
    try { if (!new RegExp(field.pattern).test(raw)) return `${field.label} does not match the format required by this Actor.`; }
    catch { /* Invalid third-party patterns are not enforced by Bizcraw. */ }
  }
  return null;
}

function matchesSchemaType(value: unknown, expected: unknown) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value != null && typeof value === "object" && !Array.isArray(value);
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "boolean") return typeof value === "boolean";
  if (expected === "string") return typeof value === "string";
  return true;
}

function validateJsonField(field: ActorField, value: unknown) {
  const schema = asRecord(field.rawSchema);
  if (value === null && field.nullable) return null;
  if (!matchesSchemaType(value, schema.type)) return `${field.label} must be valid ${text(schema.type) || "JSON"}.`;
  if (Array.isArray(value)) {
    if (field.minItems != null && value.length < field.minItems) return `${field.label} needs at least ${field.minItems} values.`;
    if (field.maxItems != null && value.length > field.maxItems) return `${field.label} allows at most ${field.maxItems} values.`;
    if (field.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return `${field.label} cannot contain duplicate values.`;
    const itemSchema = asRecord(schema.items);
    if (itemSchema.type && value.some((item) => !matchesSchemaType(item, itemSchema.type))) return `${field.label} contains an item with the wrong type.`;
  }
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
    const missing = required.find((name) => record[name] == null || record[name] === "");
    if (missing) return `${field.label} is missing required property ${missing}.`;
    const properties = asRecord(schema.properties);
    const invalid = Object.entries(properties).find(([name, child]) => record[name] != null && !matchesSchemaType(record[name], asRecord(child).type));
    if (invalid) return `${field.label}.${invalid[0]} has the wrong type.`;
  }
  return null;
}

export function buildActorInput(fields: ActorField[], values: Record<string, string>) {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name] || "";
    if (field.kind === "boolean") { body[field.name] = raw === "on"; continue; }
    if (!raw) {
      if (field.required) return { error: `Please enter ${field.label}.`, field: field.name };
      continue;
    }
    if (field.kind === "number") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return { error: `${field.label} must be a number.`, field: field.name };
      if (field.minimum != null && parsed < field.minimum) return { error: `${field.label} must be at least ${field.minimum}.`, field: field.name };
      if (field.maximum != null && parsed > field.maximum) return { error: `${field.label} must be at most ${field.maximum}.`, field: field.name };
      body[field.name] = parsed; continue;
    }
    if (field.kind === "stringList" || field.kind === "urlList" || field.kind === "multiEnum" || field.kind === "stringTags") {
      const items = listValues(raw, field.maxItems);
      if (field.minItems != null && items.length < field.minItems) return { error: `${field.label} needs at least ${field.minItems} values.`, field: field.name };
      if (field.uniqueItems && new Set(items).size !== items.length) return { error: `${field.label} cannot contain duplicate values.`, field: field.name };
      if (field.kind === "multiEnum" && items.some((item) => !field.options.some((option) => option.value === item))) {
        return { error: `${field.label} contains a value not supported by this Actor.`, field: field.name };
      }
      body[field.name] = field.kind === "urlList" ? items.map((url) => ({ url })) : items; continue;
    }
    if (field.kind === "json") {
      try {
        const parsed = JSON.parse(raw);
        const invalid = validateJsonField(field, parsed);
        if (invalid) return { error: invalid, field: field.name };
        body[field.name] = parsed;
      }
      catch { return { error: `${field.label} must contain valid JSON.`, field: field.name }; }
      continue;
    }
    if (field.kind === "enum" && !field.options.some((option) => option.value === raw)) return { error: `${field.label} must use one of the Actor's supported values.`, field: field.name };
    const invalid = validateText(field, raw);
    if (invalid) return { error: invalid, field: field.name };
    body[field.name] = raw.slice(0, field.maxLength || 5000);
  }
  const summary = Object.values(body).find((value) => typeof value === "string" && value.trim());
  return { body, summary: typeof summary === "string" ? summary.slice(0, 180) : "" };
}

export function validateActorInputObject(fields: ActorField[], input: Record<string, unknown>) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.name] = Object.prototype.hasOwnProperty.call(input, field.name) ? formatValue(input[field.name], field.kind) : field.defaultValue;
  }
  return buildActorInput(fields, values);
}

export function actorExampleInput(fields: ActorField[]) {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = field.exampleValue || field.prefillValue || field.schemaDefaultValue;
    return value ? [[field.name, value]] : [];
  }));
}

function validateJsonNode(schemaValue: unknown, value: unknown, path: string): string | null {
  const schema = asRecord(schemaValue);
  if (value === null && schema.nullable === true) return null;
  if (!matchesSchemaType(value, schema.type)) return `${path} must be ${text(schema.type) || "valid JSON"}.`;
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) return `${path} is not an accepted value.`;
  if (typeof value === "number") {
    if (finite(schema.minimum) != null && value < Number(schema.minimum)) return `${path} must be at least ${schema.minimum}.`;
    if (finite(schema.maximum) != null && value > Number(schema.maximum)) return `${path} must be at most ${schema.maximum}.`;
  }
  if (typeof value === "string") {
    if (finite(schema.minLength) != null && value.length < Number(schema.minLength)) return `${path} is too short.`;
    if (finite(schema.maxLength) != null && value.length > Number(schema.maxLength)) return `${path} is too long.`;
    if (typeof schema.pattern === "string") {
      try { if (!new RegExp(schema.pattern).test(value)) return `${path} does not match the required format.`; }
      catch { /* Invalid remote patterns are ignored. */ }
    }
  }
  if (Array.isArray(value)) {
    if (finite(schema.minItems) != null && value.length < Number(schema.minItems)) return `${path} needs at least ${schema.minItems} items.`;
    if (finite(schema.maxItems) != null && value.length > Number(schema.maxItems)) return `${path} allows at most ${schema.maxItems} items.`;
    for (let index = 0; index < value.length; index += 1) {
      const error = validateJsonNode(schema.items, value[index], `${path}[${index}]`);
      if (error) return error;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
    const missing = required.find((name) => !Object.prototype.hasOwnProperty.call(record, name));
    if (missing) return `${path}.${missing} is required.`;
    for (const [name, child] of Object.entries(asRecord(schema.properties))) {
      if (Object.prototype.hasOwnProperty.call(record, name)) {
        const error = validateJsonNode(child, record[name], `${path}.${name}`);
        if (error) return error;
      }
    }
  }
  return null;
}

export function validateActorJsonInput(schema: Json | null, input: unknown) {
  const error = validateJsonNode(schema, input, "input");
  return error ? { valid: false as const, error } : { valid: true as const, input: input as Json };
}
