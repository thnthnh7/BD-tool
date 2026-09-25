import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isReleasedLocale } from "./config";
import { getMessages } from "./messages";

export default getRequestConfig(async () => {
  const stored = (await cookies()).get("leadely-locale")?.value;
  const locale = isReleasedLocale(stored) ? stored : defaultLocale;
  return { locale, messages: getMessages(locale) };
});
