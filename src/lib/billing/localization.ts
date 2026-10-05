import type { AppLocale } from "@/i18n/config";

export type BillingMarket = {
  country: string;
  countryName: string;
  currency: string;
};

export const billingMarkets: Record<AppLocale, BillingMarket> = {
  en: { country: "US", countryName: "United States", currency: "USD" },
  vi: { country: "VN", countryName: "Vietnam", currency: "VND" },
  "zh-CN": { country: "CN", countryName: "China", currency: "CNY" },
  "zh-TW": { country: "TW", countryName: "Taiwan", currency: "TWD" },
  es: { country: "ES", countryName: "Spain", currency: "EUR" },
  "pt-BR": { country: "BR", countryName: "Brazil", currency: "BRL" },
  fr: { country: "FR", countryName: "France", currency: "EUR" },
  de: { country: "DE", countryName: "Germany", currency: "EUR" },
  it: { country: "IT", countryName: "Italy", currency: "EUR" },
  nl: { country: "NL", countryName: "Netherlands", currency: "EUR" },
  pl: { country: "PL", countryName: "Poland", currency: "PLN" },
  tr: { country: "TR", countryName: "Türkiye", currency: "TRY" },
  ru: { country: "RU", countryName: "Russia", currency: "RUB" },
  uk: { country: "UA", countryName: "Ukraine", currency: "UAH" },
  ja: { country: "JP", countryName: "Japan", currency: "JPY" },
  ko: { country: "KR", countryName: "South Korea", currency: "KRW" },
  id: { country: "ID", countryName: "Indonesia", currency: "IDR" },
  th: { country: "TH", countryName: "Thailand", currency: "THB" },
  ar: { country: "AE", countryName: "United Arab Emirates", currency: "AED" },
  hi: { country: "IN", countryName: "India", currency: "INR" },
};

export const billingMarketOptions = [
  ...Object.values(billingMarkets),
  { country: "SG", countryName: "Singapore", currency: "SGD" },
].filter((market, index, all) => all.findIndex((item) => item.country === market.country) === index);

export function marketForLocale(locale: AppLocale) {
  return billingMarkets[locale] || billingMarkets.en;
}

export function formatMinorAmount(amount: number, currency: string, locale: AppLocale) {
  const zeroDecimal = new Set(["VND", "JPY", "KRW", "TWD"]);
  const value = zeroDecimal.has(currency.toUpperCase()) ? amount : amount / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(value);
}

const fallbackUsdRates: Record<string, number> = {
  USD: 1, VND: 25000, CNY: 7.2, TWD: 32, EUR: 0.92, BRL: 5.4, PLN: 3.9,
  TRY: 44, RUB: 83, UAH: 41, JPY: 150, KRW: 1400, IDR: 16600, THB: 32,
  AED: 3.6725, INR: 92, SGD: 1.35, GBP: 0.75, AUD: 1.52, CAD: 1.39,
};

export async function loadUsdRates() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 60 * 60 * 12 } });
    if (!response.ok) return fallbackUsdRates;
    const payload = await response.json() as { result?: string; rates?: Record<string, number> };
    return payload.result === "success" && payload.rates ? { ...fallbackUsdRates, ...payload.rates } : fallbackUsdRates;
  } catch {
    return fallbackUsdRates;
  }
}

export function convertUsdCents(usdCents: number, currency: string, rates: Record<string, number>) {
  const rate = rates[currency.toUpperCase()] || 1;
  const major = (usdCents / 100) * rate;
  return ["VND", "JPY", "KRW", "TWD"].includes(currency.toUpperCase())
    ? Math.round(major)
    : Math.round(major * 100);
}
