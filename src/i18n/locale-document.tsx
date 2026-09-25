"use client";

import { useEffect } from "react";
import { localeDirection, type AppLocale } from "./config";

export function LocaleDocument({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);
  return null;
}
