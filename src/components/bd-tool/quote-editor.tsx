"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Plus, Save } from "lucide-react";
import { Button, Grid, GridCol, Group, Paper, SimpleGrid, Stack, Table, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { AiBriefAssistant } from "@/components/bd-tool/ai-brief-assistant";
import { QuoteDelivery } from "@/components/bd-tool/quote-delivery";
import { CompanyMark } from "@/components/leadely/company-mark";
import { PageHeader } from "@/components/leadely/page-header";
import { QuoteSummary } from "@/components/leadely/quote-summary";
import { SectionPanel } from "@/components/leadely/section-panel";
import { FieldLabel, NativeSelect } from "@/components/ui";
import type { AiBriefResult } from "@/lib/ai/types";
import { deliverablesFromItems } from "@/lib/deliverables";
import { createId, createPublicId } from "@/lib/ids";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import { DeleteQuoteButton } from "@/components/bd-tool/delete-quote-button";
import { createShareAction, saveQuoteAction } from "@/lib/db/actions";
import { createQuoteRevisionAction } from "@/features/deals/server/intel";
import type { Client, CompanySettings, DeliverableItem, PaymentMilestone, ProjectType, Quote, QuoteItem, ServiceModule } from "@/lib/types";

const projectTypes: ProjectType[] = ["Web App", "Mobile App", "MVP", "Internal Tool", "Maintenance", "Custom Software"];
const steps = [
  { value: "1", label: "Brief & client" },
  { value: "2", label: "Catalog" },
  { value: "3", label: "Commercial" },
  { value: "4", label: "Preview" },
];

function defaultMilestones(): PaymentMilestone[] {
  return [
    { id: createId("pay"), label: "Đợt 1", description: "Đặt cọc khởi động dự án", percent: 70, trigger: "Sau khi ký hợp đồng" },
    { id: createId("pay"), label: "Đợt 2", description: "Nghiệm thu hoàn chỉnh", percent: 30, trigger: "Sau khi nghiệm thu" },
  ];
}

function emptyQuote(settings: CompanySettings, source?: Partial<Quote>): Quote {
  const now = new Date().toISOString();
  const valid = new Date();
  valid.setDate(valid.getDate() + settings.quoteValidityDays);
  return {
    id: source?.id || crypto.randomUUID(),
    publicId: source?.publicId || createPublicId(),
    clientId: source?.clientId || "",
    title: source?.title || "",
    projectType: source?.projectType || "Web App",
    status: source?.status || "draft",
    currency: "VND",
    items: source?.items?.map((item) => ({ ...item })) || [],
    discount: source?.discount || 0,
    vatRate: source?.vatRate ?? settings.vatRate,
    validUntil: source?.validUntil || valid.toISOString().slice(0, 10),
    projectOverview: source?.projectOverview || "",
    timeline: source?.timeline || "",
    nextSteps: source?.nextSteps || "",
    deliverables: source?.deliverables?.map((item) => ({ ...item })) || [],
    contractNumber: source?.contractNumber || "",
    paymentMilestones: source?.paymentMilestones?.length ? source.paymentMilestones : defaultMilestones(),
    techStack: source?.techStack?.length ? [...source.techStack] : ["React.js", "Next.js", "Mantine", "PostgreSQL"],
    warrantyMonths: source?.warrantyMonths ?? settings.defaultWarrantyMonths,
    maintenanceFeeMonthly: source?.maintenanceFeeMonthly ?? settings.defaultMaintenanceFee,
    createdAt: source?.createdAt || now,
    updatedAt: now,
    dealId: source?.dealId,
    revisionNumber: source?.revisionNumber || 1,
    quoteStatusV2: source?.quoteStatusV2,
    deckStyle: source?.deckStyle || "signal",
    presentationSource: source?.presentationSource || "generated",
    proposalPdfPath: source?.proposalPdfPath,
    proposalPdfName: source?.proposalPdfName,
    contractDocxPath: source?.contractDocxPath,
    contractDocxName: source?.contractDocxName,
    contractStatus: source?.contractStatus || "draft",
  };
}

export function QuoteEditor({
  settings,
  clients,
  modules,
  initialQuote,
  mode = "quote",
}: {
  settings: CompanySettings;
  clients: Client[];
  modules: ServiceModule[];
  initialQuote?: Partial<Quote> | null;
  mode?: "quote" | "upload";
}) {
  const router = useRouter();
  const [step, setStep] = useState(mode === "upload" ? "4" : "1");
  const [quote, setQuote] = useState<Quote>(() => emptyQuote(settings, initialQuote || undefined));
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const client = clients.find((item) => item.id === quote.clientId) || null;
  const totals = useMemo(() => calculateQuoteTotals(quote), [quote]);
  const canSave = Boolean(quote.title.trim() && quote.clientId && (mode === "upload" ? quote.proposalPdfPath : quote.items.length));
  const filteredModules = modules.filter((module) => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return true;
    return `${module.name} ${module.category} ${module.description}`.toLowerCase().includes(query);
  });

  function update(next: Partial<Quote>) {
    setQuote({ ...quote, ...next, updatedAt: new Date().toISOString() });
  }

  async function save(status: Quote["status"] = quote.status) {
    if (!canSave) return;
    const saved = { ...quote, status };
    const result = await saveQuoteAction(saved);
    setQuote(saved);
    setMessage(result.error || "Đã lưu.");
  }

  async function share() {
    if (!canSave) return;
    const result = await createShareAction({ settings, client, quote });
    const url = result.url ? (result.url.startsWith("http") ? result.url : `${window.location.origin}/p/${result.id}`) : `${window.location.origin}/p?missing=1`;
    await navigator.clipboard.writeText(result.id ? `${window.location.origin}/p/${result.id}` : url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function applyAiBrief(brief: AiBriefResult) {
    const projectType = projectTypes.includes(brief.projectType as ProjectType) ? (brief.projectType as ProjectType) : "Custom Software";
    const items: QuoteItem[] = brief.modules.map((module) => ({
      id: createId("item"),
      name: module.name,
      description: module.description,
      qty: Math.max(1, module.quantity),
      unitPrice: Math.max(0, module.unitPrice),
    }));
    const deliverables: DeliverableItem[] = brief.deliverables.map((item) => ({
      id: createId("deliv"),
      name: item.name,
      description: item.description,
      moduleName: item.moduleName,
      priority: item.priority,
      effortDays: item.effortDays,
      referencePrice: item.referencePrice,
      notes: item.acceptanceCriteria.join("; "),
    }));
    update({
      title: brief.projectName || quote.title,
      projectType,
      projectOverview: brief.executiveSummary,
      items,
      deliverables,
      timeline: brief.timeline || quote.timeline,
      techStack: brief.recommendedTechStack.length ? brief.recommendedTechStack : quote.techStack,
    });
  }

  const stepIndex = Number(step);

  return (
    <Stack gap="md">
      <PageHeader
        back={{ href: "/app/quotes", label: "Quotes" }}
        title={quote.title.trim() || (mode === "upload" ? "Upload presentation" : "New quote")}
        subtitle={
          mode === "upload"
            ? "Tải PDF có sẵn. Không cần dựng quote từ module."
            : quote.dealId
              ? `Quote v${quote.revisionNumber || 1} · Deal ${quote.dealId.slice(0, 8)}`
              : "Tạo brief, chọn modules, rồi preview/export."
        }
        action={
          <Group gap="xs">
            {initialQuote?.id ? (
              <Button
                variant="light"
                onClick={async () => {
                  const form = new FormData();
                  form.set("quote_id", quote.id);
                  const result = await createQuoteRevisionAction(form);
                  if (result.id) router.push(`/app/quotes/${result.id}`);
                  else setMessage(result.error || "Không tạo revision.");
                }}
              >
                New revision
              </Button>
            ) : null}
            {initialQuote?.id ? (
              <DeleteQuoteButton quoteId={quote.id} label={quote.title || quote.publicId} redirectTo="/app/quotes" />
            ) : null}
            <Button variant="default" disabled={!canSave} onClick={() => save("draft")} leftSection={<Save size={16} />}>
              Save
            </Button>
            <Button disabled={!canSave} onClick={() => save("sent")} leftSection={<Check size={16} />}>
              Mark sent
            </Button>
          </Group>
        }
      />
      <Tabs value={step} onChange={(value) => value && setStep(value)} variant="default">
        <Tabs.List>
          {steps.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Grid gap="md">
        <GridCol span={{ base: 12, lg: 8 }}>
          {step === "1" ? (
            <Stack gap="md">
              <AiBriefAssistant catalog={modules} onApply={applyAiBrief} />
              <SectionPanel title="Client & project">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Stack gap={6}>
                    <FieldLabel>Client</FieldLabel>
                    <NativeSelect
                      value={quote.clientId}
                      onChange={(event) => update({ clientId: event.currentTarget.value })}
                      data={[{ value: "", label: "Select client" }, ...clients.map((item) => ({ value: item.id, label: item.companyName }))]}
                    />
                    {client ? <CompanyMark name={client.companyName} logo={client.logoUrl} /> : null}
                  </Stack>
                  <div>
                    <FieldLabel>Project type</FieldLabel>
                    <NativeSelect
                      value={quote.projectType}
                      onChange={(event) => update({ projectType: event.currentTarget.value as ProjectType })}
                      data={projectTypes.map((type) => ({ value: type, label: type }))}
                    />
                  </div>
                  <BoxSpan>
                    <FieldLabel>Quote title</FieldLabel>
                    <TextInput value={quote.title} onChange={(event) => update({ title: event.currentTarget.value })} />
                  </BoxSpan>
                  <BoxSpan>
                    <FieldLabel>Overview</FieldLabel>
                    <Textarea minRows={4} value={quote.projectOverview} onChange={(event) => update({ projectOverview: event.currentTarget.value })} />
                  </BoxSpan>
                </SimpleGrid>
              </SectionPanel>
            </Stack>
          ) : null}

          {step === "2" ? (
            <Stack gap="md">
              <SectionPanel title="Module catalog">
                <TextInput mb="md" placeholder="Search modules" value={catalogQuery} onChange={(event) => setCatalogQuery(event.currentTarget.value)} />
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  {filteredModules.map((module) => (
                    <Paper
                      key={module.id}
                      withBorder
                      p="md"
                      radius="lg"
                      role="button"
                      onClick={() =>
                        update({
                          items: [
                            ...quote.items,
                            {
                              id: createId("item"),
                              moduleId: module.id,
                              name: module.name,
                              description: module.description,
                              qty: module.defaultQty,
                              unitPrice: module.suggestedPrice,
                            },
                          ],
                        })
                      }
                      style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
                    >
                      <Text size="xs" c="dimmed" fw={600}>
                        {module.category}
                      </Text>
                      <Text fw={600} mt={4} lineClamp={2}>
                        {module.name}
                      </Text>
                      <Text size="sm" c="dimmed" mt={4} lineClamp={2}>
                        {module.description}
                      </Text>
                      <Text fw={700} mt="auto" pt="sm" ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatVnd(module.suggestedPrice)}
                      </Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              </SectionPanel>
              <SectionPanel
                title="Line items"
                action={
                  <Button
                    variant="default"
                    size="compact-md"
                    leftSection={<Plus size={14} />}
                    onClick={() =>
                      update({
                        items: [...quote.items, { id: createId("item"), name: "Custom item", description: "", qty: 1, unitPrice: 0 }],
                      })
                    }
                  >
                    Custom item
                  </Button>
                }
              >
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Unit</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {quote.items.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <TextInput value={item.name} onChange={(event) => update({ items: quote.items.map((row) => (row.id === item.id ? { ...row, name: event.currentTarget.value } : row)) })} />
                        </Table.Td>
                        <Table.Td w={90}>
                          <TextInput type="number" value={item.qty} onChange={(event) => update({ items: quote.items.map((row) => (row.id === item.id ? { ...row, qty: Number(event.currentTarget.value) } : row)) })} />
                        </Table.Td>
                        <Table.Td w={160}>
                          <TextInput type="number" value={item.unitPrice} onChange={(event) => update({ items: quote.items.map((row) => (row.id === item.id ? { ...row, unitPrice: Number(event.currentTarget.value) } : row)) })} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Button variant="default" mt="md" onClick={() => update({ deliverables: deliverablesFromItems(quote.items) })}>
                  Generate deliverables
                </Button>
              </SectionPanel>
            </Stack>
          ) : null}

          {step === "3" ? (
            <Stack gap="md">
              <SectionPanel title="Commercial">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <div>
                    <FieldLabel>Valid until</FieldLabel>
                    <TextInput type="date" value={quote.validUntil} onChange={(event) => update({ validUntil: event.currentTarget.value })} />
                  </div>
                  <div>
                    <FieldLabel>Contract number</FieldLabel>
                    <TextInput value={quote.contractNumber} onChange={(event) => update({ contractNumber: event.currentTarget.value })} />
                  </div>
                </SimpleGrid>
              </SectionPanel>
              <SectionPanel title="Timeline">
                <FieldLabel>Timeline</FieldLabel>
                <Textarea minRows={3} value={quote.timeline} onChange={(event) => update({ timeline: event.currentTarget.value })} />
                <FieldLabel mt="md">Next steps</FieldLabel>
                <Textarea minRows={3} mt="sm" value={quote.nextSteps} onChange={(event) => update({ nextSteps: event.currentTarget.value })} />
              </SectionPanel>
              <SectionPanel title="Warranty">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <div>
                    <FieldLabel>Warranty (months)</FieldLabel>
                    <TextInput type="number" value={quote.warrantyMonths} onChange={(event) => update({ warrantyMonths: Number(event.currentTarget.value) })} />
                  </div>
                  <div>
                    <FieldLabel>Maintenance fee / month</FieldLabel>
                    <TextInput type="number" value={quote.maintenanceFeeMonthly} onChange={(event) => update({ maintenanceFeeMonthly: Number(event.currentTarget.value) })} />
                  </div>
                </SimpleGrid>
              </SectionPanel>
            </Stack>
          ) : null}

          {step === "4" ? (
            <Stack gap="md">
              {mode === "upload" ? (
                <SectionPanel title="Presentation">
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="Title" value={quote.title} onChange={(event) => update({ title: event.currentTarget.value })} />
                    <Stack gap={6}>
                      <NativeSelect
                        label="Client"
                        value={quote.clientId}
                        onChange={(event) => update({ clientId: event.currentTarget.value })}
                        data={[{ value: "", label: "Select client" }, ...clients.map((item) => ({ value: item.id, label: item.companyName }))]}
                      />
                      {client ? <CompanyMark name={client.companyName} logo={client.logoUrl} /> : null}
                    </Stack>
                  </SimpleGrid>
                </SectionPanel>
              ) : null}
              <QuoteDelivery
                settings={settings}
                quote={quote}
                client={client}
                canShare={canSave}
                copied={copied}
                message={message}
                onChange={update}
                onShare={share}
              />
            </Stack>
          ) : null}

          <Group justify="space-between" mt="md">
            <Button variant="default" disabled={stepIndex === 1} onClick={() => setStep(String(stepIndex - 1))}>
              Back
            </Button>
            <Button disabled={stepIndex === 4} onClick={() => setStep(String(stepIndex + 1))} rightSection={<ArrowRight size={16} />}>
              Continue
            </Button>
          </Group>
        </GridCol>
        <GridCol span={{ base: 12, lg: 4 }}>
          <div style={{ position: "sticky", top: 24 }}>
            <QuoteSummary quote={quote} client={client} subtotal={totals.subtotal} vat={totals.vatAmount} grandTotal={totals.grandTotal} />
          </div>
        </GridCol>
      </Grid>
    </Stack>
  );
}

function BoxSpan({ children }: { children: ReactNode }) {
  return <div style={{ gridColumn: "1 / -1" }}>{children}</div>;
}
