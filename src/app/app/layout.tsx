import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "@/i18n/messages";
import { LocaleDocument } from "@/i18n/locale-document";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireUser();
  if (context.kind === "onboarding") redirect("/onboarding");
  return (
    <NextIntlClientProvider locale={context.locale} messages={getMessages(context.locale)}>
      <LocaleDocument locale={context.locale} />
      <AppShell context={context}>{children}</AppShell>
    </NextIntlClientProvider>
  );
}
