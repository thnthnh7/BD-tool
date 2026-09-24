export const LIST_PAGE_SIZE = 20;

export function readListQuery(params: { q?: string; page?: string }) {
  return readNamedQuery(params, "q");
}

export function readNamedQuery(params: Record<string, string | undefined>, name = "q") {
  const pageKey = name === "q" ? "page" : `${name}Page`;
  return {
    q: (params[name] || "").trim(),
    page: Math.max(1, Number.parseInt(params[pageKey] || "1", 10) || 1),
  };
}

export function matchesQuery(query: string, values: Array<string | number | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

export function slicePage<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), total === 0 ? 1 : pageCount);
  const start = (current - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}
