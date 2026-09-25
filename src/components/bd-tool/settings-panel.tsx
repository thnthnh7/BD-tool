"use client";

import { useState, type ReactNode } from "react";
import { Box, Button, Group, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { FieldLabel } from "@/components/ui";
import { WorkspaceLogoField } from "@/components/leadely/logo-field";
import { convertToCompanyAction } from "@/lib/auth/actions";
import { importLocalDataAction, saveSettingsAction } from "@/lib/db/actions";
import type { CompanySettings } from "@/lib/types";
import { useTranslations } from "next-intl";

const sections = [
  { id: "language", label: "language" },
  { id: "apify", label: "apify" },
  { id: "ai", label: "ai" },
  { id: "workspace", label: "workspace" },
  { id: "branding", label: "branding" },
  { id: "quotes", label: "quotes" },
  { id: "legal", label: "legal" },
  { id: "banking", label: "banking" },
  { id: "data", label: "data" },
] as const;

export function SettingsPanel({
  initial,
  workspaceType,
  isOwner,
  apifyProvider,
  aiProvider,
  languageProvider,
}: {
  initial: CompanySettings;
  workspaceType: "personal" | "company";
  isOwner: boolean;
  apifyProvider: ReactNode;
  aiProvider: ReactNode;
  languageProvider: ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("language");

  function update(next: Partial<CompanySettings>) {
    setSettings({ ...settings, ...next });
  }

  async function save() {
    const result = await saveSettingsAction(settings);
    setMessage(result.error || t("saved"));
  }

  return (
    <Stack gap="md">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={section !== "ai" && section !== "apify" && section !== "language" ? <Button onClick={save}>{common("save")}</Button> : undefined}
      />
      {message ? (
        <Text size="sm" c="leadely">
          {message}
        </Text>
      ) : null}
      <Tabs value={section} onChange={(value) => { if (value) setSection(value as typeof section); }}>
          <Tabs.List mb="md" aria-label={t("title")}>
            {sections.map((item) => (
              <Tabs.Tab key={item.id} value={item.id}>{t(item.label)}</Tabs.Tab>
            ))}
          </Tabs.List>
        <Tabs.Panel value={section}>
        <Box maw={900}>
          {section === "apify" ? apifyProvider : null}
          {section === "ai" ? aiProvider : null}
          {section === "language" ? languageProvider : null}
          {section === "workspace" ? (
            <SectionPanel title={t("workspaceCompany")}>
              <Stack gap="md">
                <div>
                  <FieldLabel>{t("nameOnQuotes")}</FieldLabel>
                  <TextInput value={settings.companyName} onChange={(event) => update({ companyName: event.currentTarget.value })} />
                </div>
                {workspaceType === "company" ? (
                  <Group grow>
                    <div>
                      <FieldLabel>{t("taxCode")}</FieldLabel>
                      <TextInput value={settings.taxCode} onChange={(event) => update({ taxCode: event.currentTarget.value })} />
                    </div>
                    <div>
                      <FieldLabel>{t("legalRepresentative")}</FieldLabel>
                      <TextInput value={settings.legalRepresentative} onChange={(event) => update({ legalRepresentative: event.currentTarget.value })} />
                    </div>
                  </Group>
                ) : null}
                <div>
                  <FieldLabel>{t("address")}</FieldLabel>
                  <TextInput value={settings.address} onChange={(event) => update({ address: event.currentTarget.value })} />
                </div>
                <Group grow>
                  <TextInput placeholder={t("email")} value={settings.email} onChange={(event) => update({ email: event.currentTarget.value })} />
                  <TextInput placeholder={t("phone")} value={settings.phone} onChange={(event) => update({ phone: event.currentTarget.value })} />
                </Group>
                <TextInput placeholder={t("website")} value={settings.website} onChange={(event) => update({ website: event.currentTarget.value })} />
                {isOwner && workspaceType === "personal" ? (
                  <Button variant="default" onClick={() => convertToCompanyAction()} w="fit-content">
                    {t("convertCompany")}
                  </Button>
                ) : null}
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "branding" ? (
            <SectionPanel title={t("branding")}>
              <Stack gap="md">
                <div>
                  <FieldLabel>{t("shortName")}</FieldLabel>
                  <TextInput value={settings.shortName} onChange={(event) => update({ shortName: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>{t("accentColor")}</FieldLabel>
                  <TextInput value={settings.accentColor} onChange={(event) => update({ accentColor: event.currentTarget.value })} />
                </div>
                <WorkspaceLogoField
                  logoPath={settings.logoPath}
                  shortName={settings.shortName}
                  onChange={(logoPath) => update({ logoPath })}
                />
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "quotes" ? (
            <SectionPanel title={t("quotes")}>
              <Stack gap="md">
                <Group grow>
                  <div>
                    <FieldLabel>{t("vat")}</FieldLabel>
                    <TextInput type="number" value={settings.vatRate} onChange={(event) => update({ vatRate: Number(event.currentTarget.value) })} />
                  </div>
                  <div>
                    <FieldLabel>{t("validityDays")}</FieldLabel>
                    <TextInput type="number" value={settings.quoteValidityDays} onChange={(event) => update({ quoteValidityDays: Number(event.currentTarget.value) })} />
                  </div>
                </Group>
                <Group grow>
                  <div>
                    <FieldLabel>{t("warrantyMonths")}</FieldLabel>
                    <TextInput type="number" value={settings.defaultWarrantyMonths} onChange={(event) => update({ defaultWarrantyMonths: Number(event.currentTarget.value) })} />
                  </div>
                  <div>
                    <FieldLabel>{t("maintenanceFee")}</FieldLabel>
                    <TextInput type="number" value={settings.defaultMaintenanceFee} onChange={(event) => update({ defaultMaintenanceFee: Number(event.currentTarget.value) })} />
                  </div>
                </Group>
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "legal" ? (
            <SectionPanel title={t("legal")}>
              <Stack gap="md">
                <div>
                  <FieldLabel>{t("representativeTitle")}</FieldLabel>
                  <TextInput value={settings.legalRepresentativeTitle} onChange={(event) => update({ legalRepresentativeTitle: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>{t("contractPrefix")}</FieldLabel>
                  <TextInput value={settings.contractNumberPrefix} onChange={(event) => update({ contractNumberPrefix: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>{t("about")}</FieldLabel>
                  <Textarea minRows={4} value={settings.about} onChange={(event) => update({ about: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>{t("terms")}</FieldLabel>
                  <Textarea minRows={5} value={settings.terms.join("\n")} onChange={(event) => update({ terms: event.currentTarget.value.split("\n") })} />
                </div>
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "banking" ? (
            <SectionPanel title={t("banking")}>
              <Stack gap="md">
                <TextInput placeholder={t("bankName")} value={settings.bankName} onChange={(event) => update({ bankName: event.currentTarget.value })} />
                <TextInput placeholder={t("accountName")} value={settings.bankAccountName} onChange={(event) => update({ bankAccountName: event.currentTarget.value })} />
                <TextInput placeholder={t("accountNumber")} value={settings.bankAccountNumber} onChange={(event) => update({ bankAccountNumber: event.currentTarget.value })} />
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "data" && isOwner ? <ImportBox /> : null}
        </Box>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function ImportBox() {
  const t = useTranslations("Settings");
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState("");
  return (
    <SectionPanel title={t("importTitle")}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {t("importHelp")}
        </Text>
        <Textarea minRows={6} value={raw} onChange={(event) => setRaw(event.currentTarget.value)} />
        <Button
          w="fit-content"
          onClick={async () => {
            const result = await importLocalDataAction(raw);
            setStatus(result.error || t("imported"));
          }}
        >
          {t("import")}
        </Button>
        {status ? <Text size="sm">{status}</Text> : null}
      </Stack>
    </SectionPanel>
  );
}
