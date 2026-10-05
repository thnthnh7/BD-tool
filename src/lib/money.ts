import type { Quote, QuoteTotals } from "./types";

export const DEAL_CURRENCIES = ["USD", "VND", "EUR", "GBP", "SGD", "AUD", "CAD", "CNY", "JPY", "KRW", "AED", "INR", "THB", "IDR"] as const;

export function normalizeDealCurrency(value: string | null | undefined) {
  const currency = String(value || "VND").trim().toUpperCase();
  return DEAL_CURRENCIES.includes(currency as (typeof DEAL_CURRENCIES)[number]) ? currency : "VND";
}

export function formatCurrency(value: number, currency: string, compact = false) {
  const normalized = normalizeDealCurrency(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalized,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: ["VND", "JPY", "KRW", "IDR"].includes(normalized) ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function convertCurrency(value: number, fromCurrency: string, toCurrency: string, usdRates: Record<string, number>) {
  const from = normalizeDealCurrency(fromCurrency);
  const to = normalizeDealCurrency(toCurrency);
  const fromRate = usdRates[from];
  const toRate = usdRates[to];
  if (!Number.isFinite(value) || !fromRate || !toRate) return 0;
  return (value / fromRate) * toRate;
}

export function currencyTotals(items: Array<{ amount: number; currency?: string | null }>) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const currency = normalizeDealCurrency(item.currency);
    totals[currency] = (totals[currency] || 0) + (Number.isFinite(item.amount) ? item.amount : 0);
    return totals;
  }, {});
}

export function formatCurrencyTotals(totals: Record<string, number>, compact = false) {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
  return entries.length ? entries.map(([currency, amount]) => formatCurrency(amount, currency, compact)).join(" · ") : "—";
}

export function formatUsdFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function calculateQuoteTotals(quote: Pick<Quote, "items" | "discount" | "vatRate">): QuoteTotals {
  const subtotal = quote.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const discountAmount = subtotal * (quote.discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const vatAmount = taxableAmount * (quote.vatRate / 100);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    vatAmount,
    grandTotal: taxableAmount + vatAmount,
  };
}
