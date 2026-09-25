import type { AppLocale } from "./config";

export function formatNumber(value: number, locale: AppLocale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(value: number, locale: AppLocale, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function formatDate(value: Date | string | number, locale: AppLocale, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
