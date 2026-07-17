import type { Quote, QuoteTotals } from "./types";

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
