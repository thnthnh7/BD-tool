"use client";

import { NativeSelect, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/features/crm/components/action-form";
import { localeNames, releasedLocales, type AppLocale } from "@/i18n/config";
import { SectionPanel } from "@/components/leadely/section-panel";
import { savePersonalLocaleAction } from "../server/locale-actions";

const options = releasedLocales.map((locale) => ({ value: locale, label: localeNames[locale] }));

export function LocaleSettings({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Language");
  return (
    <SectionPanel title={t("title")}>
      <Stack gap="md">
        <Text size="sm">{t("description")}</Text>
        <ActionForm action={savePersonalLocaleAction} submitLabel={t("savePersonal")}>
          <NativeSelect name="locale" label={t("personal")} description={t("personalHelp")} defaultValue={locale} data={options} />
        </ActionForm>
        <Text size="xs" c="dimmed">{t("coming")}</Text>
      </Stack>
    </SectionPanel>
  );
}
