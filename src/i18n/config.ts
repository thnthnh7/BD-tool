export const locales = [
  "en", "vi", "zh-CN", "zh-TW", "es", "pt-BR", "fr", "de", "it", "nl",
  "pl", "tr", "ru", "uk", "ja", "ko", "id", "th", "ar", "hi",
] as const;

export type AppLocale = (typeof locales)[number];

export const releasedLocales = locales;
export const defaultLocale: AppLocale = "en";

export const localeNames: Record<AppLocale, string> = {
  en: "English",
  vi: "Tiếng Việt",
  "zh-CN": "中文（简体）",
  "zh-TW": "中文（繁體）",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  ru: "Русский",
  uk: "Українська",
  ja: "日本語",
  ko: "한국어",
  id: "Bahasa Indonesia",
  th: "ไทย",
  ar: "العربية",
  hi: "हिन्दी",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && locales.includes(value as AppLocale);
}

export function isReleasedLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && releasedLocales.includes(value as AppLocale);
}

export function localeDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}
