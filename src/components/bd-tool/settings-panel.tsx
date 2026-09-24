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

const sections = [
  { id: "apify", label: "Apify" },
  { id: "ai", label: "AI provider" },
  { id: "workspace", label: "Workspace" },
  { id: "branding", label: "Branding" },
  { id: "quotes", label: "Quote defaults" },
  { id: "legal", label: "Legal & contract" },
  { id: "banking", label: "Banking" },
  { id: "data", label: "Data" },
] as const;

export function SettingsPanel({
  initial,
  workspaceType,
  isOwner,
  apifyProvider,
  aiProvider,
}: {
  initial: CompanySettings;
  workspaceType: "personal" | "company";
  isOwner: boolean;
  apifyProvider: ReactNode;
  aiProvider: ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("apify");

  function update(next: Partial<CompanySettings>) {
    setSettings({ ...settings, ...next });
  }

  async function save() {
    const result = await saveSettingsAction(settings);
    setMessage(result.error || "Saved.");
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Settings"
        subtitle="Quản lý workspace, thương hiệu và AI dùng chung."
        action={section !== "ai" && section !== "apify" ? <Button onClick={save}>Save</Button> : undefined}
      />
      {message ? (
        <Text size="sm" c="leadely">
          {message}
        </Text>
      ) : null}
      <Tabs value={section} onChange={(value) => { if (value) setSection(value as typeof section); }}>
          <Tabs.List mb="md" aria-label="Cài đặt workspace">
            {sections.map((item) => (
              <Tabs.Tab key={item.id} value={item.id}>{item.label}</Tabs.Tab>
            ))}
          </Tabs.List>
        <Tabs.Panel value={section}>
        <Box maw={900}>
          {section === "apify" ? apifyProvider : null}
          {section === "ai" ? aiProvider : null}
          {section === "workspace" ? (
            <SectionPanel title="Workspace / company">
              <Stack gap="md">
                <div>
                  <FieldLabel>Name on quotes</FieldLabel>
                  <TextInput value={settings.companyName} onChange={(event) => update({ companyName: event.currentTarget.value })} />
                </div>
                {workspaceType === "company" ? (
                  <Group grow>
                    <div>
                      <FieldLabel>Tax code</FieldLabel>
                      <TextInput value={settings.taxCode} onChange={(event) => update({ taxCode: event.currentTarget.value })} />
                    </div>
                    <div>
                      <FieldLabel>Legal representative</FieldLabel>
                      <TextInput value={settings.legalRepresentative} onChange={(event) => update({ legalRepresentative: event.currentTarget.value })} />
                    </div>
                  </Group>
                ) : null}
                <div>
                  <FieldLabel>Address</FieldLabel>
                  <TextInput value={settings.address} onChange={(event) => update({ address: event.currentTarget.value })} />
                </div>
                <Group grow>
                  <TextInput placeholder="Email" value={settings.email} onChange={(event) => update({ email: event.currentTarget.value })} />
                  <TextInput placeholder="Phone" value={settings.phone} onChange={(event) => update({ phone: event.currentTarget.value })} />
                </Group>
                <TextInput placeholder="Website" value={settings.website} onChange={(event) => update({ website: event.currentTarget.value })} />
                {isOwner && workspaceType === "personal" ? (
                  <Button variant="default" onClick={() => convertToCompanyAction()} w="fit-content">
                    Convert to company
                  </Button>
                ) : null}
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "branding" ? (
            <SectionPanel title="Branding">
              <Stack gap="md">
                <div>
                  <FieldLabel>Short name</FieldLabel>
                  <TextInput value={settings.shortName} onChange={(event) => update({ shortName: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>Accent color</FieldLabel>
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
            <SectionPanel title="Quote defaults">
              <Stack gap="md">
                <Group grow>
                  <div>
                    <FieldLabel>VAT %</FieldLabel>
                    <TextInput type="number" value={settings.vatRate} onChange={(event) => update({ vatRate: Number(event.currentTarget.value) })} />
                  </div>
                  <div>
                    <FieldLabel>Validity days</FieldLabel>
                    <TextInput type="number" value={settings.quoteValidityDays} onChange={(event) => update({ quoteValidityDays: Number(event.currentTarget.value) })} />
                  </div>
                </Group>
                <Group grow>
                  <div>
                    <FieldLabel>Warranty months</FieldLabel>
                    <TextInput type="number" value={settings.defaultWarrantyMonths} onChange={(event) => update({ defaultWarrantyMonths: Number(event.currentTarget.value) })} />
                  </div>
                  <div>
                    <FieldLabel>Maintenance fee</FieldLabel>
                    <TextInput type="number" value={settings.defaultMaintenanceFee} onChange={(event) => update({ defaultMaintenanceFee: Number(event.currentTarget.value) })} />
                  </div>
                </Group>
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "legal" ? (
            <SectionPanel title="Legal & contract">
              <Stack gap="md">
                <div>
                  <FieldLabel>Representative title</FieldLabel>
                  <TextInput value={settings.legalRepresentativeTitle} onChange={(event) => update({ legalRepresentativeTitle: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>Contract prefix</FieldLabel>
                  <TextInput value={settings.contractNumberPrefix} onChange={(event) => update({ contractNumberPrefix: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>About</FieldLabel>
                  <Textarea minRows={4} value={settings.about} onChange={(event) => update({ about: event.currentTarget.value })} />
                </div>
                <div>
                  <FieldLabel>Terms</FieldLabel>
                  <Textarea minRows={5} value={settings.terms.join("\n")} onChange={(event) => update({ terms: event.currentTarget.value.split("\n") })} />
                </div>
              </Stack>
            </SectionPanel>
          ) : null}

          {section === "banking" ? (
            <SectionPanel title="Banking">
              <Stack gap="md">
                <TextInput placeholder="Bank name" value={settings.bankName} onChange={(event) => update({ bankName: event.currentTarget.value })} />
                <TextInput placeholder="Account name" value={settings.bankAccountName} onChange={(event) => update({ bankAccountName: event.currentTarget.value })} />
                <TextInput placeholder="Account number" value={settings.bankAccountNumber} onChange={(event) => update({ bankAccountNumber: event.currentTarget.value })} />
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
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState("");
  return (
    <SectionPanel title="Import localStorage">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Paste JSON key `csj-bd-tool-data-v1` from the previous local app.
        </Text>
        <Textarea minRows={6} value={raw} onChange={(event) => setRaw(event.currentTarget.value)} />
        <Button
          w="fit-content"
          onClick={async () => {
            const result = await importLocalDataAction(raw);
            setStatus(result.error || "Imported.");
          }}
        >
          Import
        </Button>
        {status ? <Text size="sm">{status}</Text> : null}
      </Stack>
    </SectionPanel>
  );
}
