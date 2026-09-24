import type { PeriodKey } from "./types";

export const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
];

export function inPeriod(iso: string | null | undefined, period: PeriodKey, fallbackIso?: string) {
  const source = iso || fallbackIso;
  if (!source) return period === "all";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return period === "all";
  if (period === "all") return true;
  const now = new Date();
  if (period === "30d") return date.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (period === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3);
  return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === quarter;
}

export function compactVnd(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ`;
  if (Math.abs(amount) >= 1_000_000) return `${Math.round(amount / 1_000_000)}tr`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount));
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("vi-VN");
}

export function formatDueTime(iso: string | null | undefined) {
  if (!iso) return "No due date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
