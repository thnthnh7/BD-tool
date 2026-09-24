import type { Json } from "@/lib/database.types";

export type DatasetRow = { id: string; label: string; data: Record<string, Json | undefined> };
export type DatasetColumn = { key: string; path: string[]; label: string };

const preferredFields = [
  "title", "name", "fullName", "full_name", "username", "query", "searchQuery", "url", "website",
  "address", "phone", "email", "biography", "description", "snippet", "followersCount", "followers",
  "position", "totalScore", "rating", "reviewsCount", "organicResults", "people",
];

export function datasetRecord(value: Json | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return { value: value ?? null };
}

/** Remove only our legacy ingestion marker, not similarly named nested actor fields. */
export function datasetRaw(value: Json): Record<string, Json | undefined> {
  return Object.fromEntries(Object.entries(datasetRecord(value)).filter(([key]) => key !== "ingest_key"));
}

export function datasetColumns(rows: DatasetRow[]): DatasetColumn[] {
  const columns = new Map<string, DatasetColumn>();
  function visit(record: Record<string, Json | undefined>, parent: string[] = []) {
    for (const [key, value] of Object.entries(record)) {
      const path = [...parent, key];
      const id = JSON.stringify(path);
      if (!columns.has(id)) columns.set(id, { key: id, path, label: path.join(" › ") });
      if (value && typeof value === "object" && !Array.isArray(value) && path.length < 3) visit(value, path);
    }
  }
  for (const row of rows) visit(row.data);
  return [...columns.values()];
}

export function defaultDatasetColumns(columns: DatasetColumn[]) {
  const top = columns.filter((column) => column.path.length === 1);
  const rank = (column: DatasetColumn) => {
    const index = preferredFields.indexOf(column.path[0]);
    return index === -1 ? preferredFields.length : index;
  };
  return [...top].sort((a, b) => rank(a) - rank(b)).slice(0, 7).map((column) => column.key);
}

export function datasetValue(record: Record<string, Json | undefined>, path: string[]): Json | undefined {
  let value: Json | undefined = record;
  for (const key of path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  }
  return value;
}

export function datasetText(value: Json | undefined): string {
  if (value == null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function filterDataset(rows: DatasetRow[], query: string, column?: DatasetColumn) {
  const needle = query.trim().toLocaleLowerCase("vi");
  if (!needle) return rows;
  return rows.filter((row) => datasetText(column ? datasetValue(row.data, column.path) : row.data).toLocaleLowerCase("vi").includes(needle));
}

export function sortDataset(rows: DatasetRow[], column: DatasetColumn | undefined, descending: boolean) {
  if (!column) return rows;
  return [...rows].sort((a, b) => {
    const av = datasetValue(a.data, column.path);
    const bv = datasetValue(b.data, column.path);
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    const order = typeof av === "number" && typeof bv === "number"
      ? av - bv : datasetText(av).localeCompare(datasetText(bv), "vi", { numeric: true });
    return descending ? -order : order;
  });
}

export function datasetCsv(rows: DatasetRow[], columns: DatasetColumn[]) {
  const escape = (value: Json | undefined) => {
    let text = datasetText(value);
    // CSV is opened in spreadsheet programs: actor-provided formulas must remain text.
    if (/^[\s]*[=+@-]/.test(text) && typeof value !== "number") text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [columns.map((column) => escape(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escape(datasetValue(row.data, column.path))).join(",")),
  ].join("\r\n");
}

export function safeDatasetUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
