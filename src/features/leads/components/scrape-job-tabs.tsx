"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@mantine/core";
import { Database, FileInput, Info, Users } from "lucide-react";
import { useTranslations } from "next-intl";

export function ScrapeJobTabs({ results, input, processing, crm, initialTab, status }: {
  results: ReactNode; input: ReactNode; processing: ReactNode; crm?: ReactNode; initialTab: string; status: string;
}) {
  const router = useRouter();
  const t = useTranslations("Scrape");
  useEffect(() => {
    if (!["queued", "running", "ingesting"].includes(status)) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [status, router]);
  return <Tabs defaultValue={initialTab} keepMounted={false}>
    <Tabs.List mb="md">
      <Tabs.Tab value="results" leftSection={<Database size={15} />}>{t("tabResults")}</Tabs.Tab>
      {crm && <Tabs.Tab value="crm" leftSection={<Users size={15} />}>{t("tabCrm")}</Tabs.Tab>}
      <Tabs.Tab value="input" leftSection={<FileInput size={15} />}>{t("tabInput")}</Tabs.Tab>
      <Tabs.Tab value="processing" leftSection={<Info size={15} />}>{t("tabProcessing")}</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="results">{results}</Tabs.Panel>
    <Tabs.Panel value="crm">{crm}</Tabs.Panel>
    <Tabs.Panel value="input">{input}</Tabs.Panel>
    <Tabs.Panel value="processing">{processing}</Tabs.Panel>
  </Tabs>;
}
