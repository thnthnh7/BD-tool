import type { ReactNode } from "react";
import { Badge, Divider, Grid, GridCol, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { notFound } from "next/navigation";
import { CompanyMark } from "@/components/leadely/company-mark";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActivityList, NoteForm } from "@/features/crm/components/activity-panel";
import { listContacts } from "@/features/companies/server/actions";
import { addDealStakeholderAction, getDeal, listDealStakeholders, listPipelines } from "@/features/deals/server/actions";
import { DealEditButton, DealTaskList, StageMoveForm } from "@/features/deals/components/deal-workspace";
import { createTaskAction, listActivities, listDealTasks } from "@/features/tasks/server/actions";
import { generateDealIntelAction, listContracts, listDealQuotes, listQuoteEngagement } from "@/features/deals/server/intel";
import { DEAL_PRIORITIES, DEAL_TYPES, STAKEHOLDER_ROLES } from "@/lib/crm";
import { clientInitials } from "@/lib/image";
import { formatVnd } from "@/lib/money";
import classes from "@/styles/leadely-dashboard.module.css";

const COVERAGE_ROLES = [
  ["decision_maker", "Decision maker"],
  ["champion", "Champion"],
  ["economic_buyer", "Economic buyer"],
] as const;

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, stakeholders, tasks, activities, pipelineData, contacts, quotes, contracts] = await Promise.all([
    getDeal(id),
    listDealStakeholders(id),
    listDealTasks(id),
    listActivities({ dealId: id }),
    listPipelines(),
    listContacts(),
    listDealQuotes(id),
    listContracts(id),
  ]);
  if (!deal) notFound();
  const stages = pipelineData.stages.filter((item) => item.pipeline_id === deal.pipeline_id).sort((a, b) => a.position - b.position);
  const stage = stages.find((item) => item.id === deal.stage_id);
  const roles = new Set(stakeholders.map((row) => row.stakeholder_role));
  const latestQuote = quotes[0];
  const engagement = latestQuote ? await listQuoteEngagement(latestQuote.id) : [];
  const intel = readIntel(activities);
  const quoteHref = `/app/quotes/new?dealId=${deal.id}&clientHint=${deal.company_id}`;
  const choice = (values: readonly string[]) => values.map((item) => ({ value: item, label: labelize(item) }));

  return (
    <Stack gap="md">
      <PageHeader
        back={{ href: "/app/deals", label: "Deals" }}
        title={deal.title}
        mark={
          deal.companies?.name
            ? { src: deal.companies.logo_path, initials: clientInitials(deal.companies.name) }
            : undefined
        }
        subtitle={`${deal.companies?.name || "No company"} · ${formatVnd(deal.amount)}`}
        action={
          <Group gap="sm" wrap="nowrap">
            {stage ? <StatusBadge status={stage.stage_type || "open"} /> : null}
            <LinkButton href={quoteHref} variant="light">
              New quote
            </LinkButton>
          </Group>
        }
      />

      <Paper withBorder radius="lg" className={classes.panel} p="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Fact label="Stage" value={stage?.name || "—"} />
          <Fact label="Probability" value={`${deal.probability}%`} />
          <Fact label="Weighted" value={formatVnd(Math.round(deal.amount * (deal.probability / 100)))} />
          <Fact label="Close date" value={formatDay(deal.expected_close_date)} />
        </SimpleGrid>
        <Divider my="sm" />
        <Group gap="xs">
          {COVERAGE_ROLES.map(([role, label]) => {
            const present = roles.has(role);
            return (
              <Badge key={role} color={present ? "leadely" : "gray"} variant={present ? "light" : "outline"}>
                {present ? label : `${label} missing`}
              </Badge>
            );
          })}
        </Group>
      </Paper>

      <Grid>
        <GridCol span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <SectionPanel title="Timeline">
              <NoteForm compact dealId={deal.id} companyId={deal.company_id} contactId={deal.primary_contact_id || undefined} />
              <ActivityList items={activities} />
            </SectionPanel>
            <Grid>
              <GridCol span={{ base: 12, sm: 6 }}>
                <SectionPanel title="Quotes" action={<LinkAnchor href={quoteHref} size="sm">New</LinkAnchor>}>
                  {quotes.length ? (
                    <Stack gap="xs">
                      {quotes.map((quote) => (
                        <Group key={quote.id} justify="space-between" wrap="nowrap" gap="sm">
                          <LinkAnchor href={`/app/quotes/${quote.id}`} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                            {quote.title || quote.public_id} · v{quote.revision_number}
                          </LinkAnchor>
                          <StatusBadge status={quote.status} />
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Chưa có quote.
                    </Text>
                  )}
                  {engagement.length ? (
                    <Text size="xs" c="dimmed" mt="sm">
                      Latest · {labelize(engagement[0].event_type)} · {formatStamp(engagement[0].occurred_at)}
                    </Text>
                  ) : null}
                </SectionPanel>
              </GridCol>
              <GridCol span={{ base: 12, sm: 6 }}>
                <SectionPanel title="Contracts" action={<LinkAnchor href="/app/contracts" size="sm">New</LinkAnchor>}>
                  {contracts.length ? (
                    <Stack gap="xs">
                      {contracts.map((contract) => (
                        <Group key={contract.id} justify="space-between" wrap="nowrap" gap="sm">
                          <Text size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                            {contract.title}
                          </Text>
                          <StatusBadge status={contract.status} />
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Chưa có contract.
                    </Text>
                  )}
                </SectionPanel>
              </GridCol>
            </Grid>
            <SectionPanel title="People">
              {stakeholders.length ? (
                <Stack gap="xs" mb="sm">
                  {stakeholders.map((row) => (
                    <Group key={`${row.deal_id}-${row.contact_id}`} justify="space-between" wrap="nowrap" gap="sm">
                      <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                        {row.contacts?.display_name || "Contact"}
                      </Text>
                      <Group gap={6} wrap="nowrap">
                        <Badge variant="light" color="gray">
                          {labelize(row.stakeholder_role)}
                        </Badge>
                        {row.is_primary ? (
                          <Badge variant="light" color="leadely">
                            Primary
                          </Badge>
                        ) : null}
                      </Group>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" mb="sm">
                  Chưa có stakeholder.
                </Text>
              )}
              {contacts.length ? (
                <ActionForm action={addDealStakeholderAction} submitLabel="Add" layout="inline">
                  <input type="hidden" name="deal_id" value={deal.id} />
                  <NativeSelect
                    name="contact_id"
                    aria-label="Contact"
                    data={contacts.map((item) => ({ value: item.id, label: item.display_name }))}
                    style={{ flex: "1 1 180px" }}
                  />
                  <NativeSelect
                    name="stakeholder_role"
                    aria-label="Role"
                    data={choice(STAKEHOLDER_ROLES)}
                    style={{ flex: "1 1 180px" }}
                  />
                </ActionForm>
              ) : (
                <Text size="sm" c="dimmed">
                  <LinkAnchor href="/app/contacts">Thêm contact</LinkAnchor> trước khi gán vào deal.
                </Text>
              )}
            </SectionPanel>
          </Stack>
        </GridCol>

        <GridCol span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <SectionPanel
              title="Next step"
              action={
                <ActionForm action={generateDealIntelAction} submitLabel="AI summary">
                  <input type="hidden" name="deal_id" value={deal.id} />
                </ActionForm>
              }
            >
              {intel ? (
                <Stack gap={4} mb="sm">
                  {intel.next ? (
                    <Text size="sm" fw={600}>
                      {intel.next}
                    </Text>
                  ) : null}
                  {intel.summary ? (
                    <Text size="sm" c="dimmed">
                      {intel.summary}
                    </Text>
                  ) : null}
                  {intel.risks.length ? (
                    <Text size="xs" c="dimmed">
                      Risks · {intel.risks.join(" · ")}
                    </Text>
                  ) : null}
                </Stack>
              ) : null}
              <DealTaskList
                tasks={tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  dueAt: task.due_at,
                }))}
              />
              <Divider my="sm" />
              <ActionForm action={createTaskAction} submitLabel="Add" layout="inline">
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="company_id" value={deal.company_id} />
                <input type="hidden" name="type" value="follow_up" />
                <TextInput name="title" placeholder="Task" required aria-label="Task title" style={{ flex: "1 1 140px" }} />
                <TextInput name="due_at" type="datetime-local" aria-label="Due" w={210} />
              </ActionForm>
              <Divider my="sm" />
              <StageMoveForm
                key={deal.stage_id}
                dealId={deal.id}
                currentStageId={deal.stage_id}
                stages={stages.map((item) => ({ id: item.id, name: item.name, stageType: item.stage_type }))}
              />
            </SectionPanel>

            <SectionPanel
              title="Details"
              action={
                <DealEditButton
                  deal={{
                    id: deal.id,
                    updatedAt: deal.updated_at,
                    title: deal.title,
                    amount: deal.amount,
                    dealType: deal.deal_type,
                    priority: deal.priority,
                    expectedCloseDate: deal.expected_close_date || "",
                    description: deal.description || "",
                    types: choice(DEAL_TYPES),
                    priorities: choice(DEAL_PRIORITIES),
                  }}
                />
              }
            >
              <Stack gap={6}>
                <SummaryRow
                  label="Company"
                  value={
                    <LinkAnchor href={`/app/companies/${deal.company_id}`} underline="never">
                      <CompanyMark name={deal.companies?.name || "—"} logo={deal.companies?.logo_path} />
                    </LinkAnchor>
                  }
                />
                <SummaryRow label="Type" value={labelize(deal.deal_type)} />
                <SummaryRow label="Priority" value={labelize(deal.priority)} />
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Description
                  </Text>
                  <Text size="sm">{deal.description || "—"}</Text>
                </Stack>
                {deal.lost_reason ? <SummaryRow label="Lost reason" value={deal.lost_reason} /> : null}
              </Stack>
            </SectionPanel>
          </Stack>
        </GridCol>
      </Grid>
    </Stack>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} lineClamp={1}>
        {value}
      </Text>
    </Stack>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right" style={{ minWidth: 0 }}>
        {value}
      </Text>
    </Group>
  );
}

function labelize(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

function formatDay(value: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readIntel(activities: { activity_type: string; body: string | null }[]) {
  const item = activities.find((activity) => activity.activity_type === "ai_recommendation");
  if (!item?.body) return null;
  try {
    const parsed = JSON.parse(item.body) as { summary?: string; nextBestAction?: string; risks?: unknown };
    const risks = Array.isArray(parsed.risks) ? parsed.risks.map((risk) => String(risk)).filter(Boolean) : [];
    const summary = parsed.summary?.trim() || "";
    const next = parsed.nextBestAction?.trim() || "";
    if (!summary && !next && !risks.length) return { summary: item.body, next: "", risks: [] };
    return { summary, next, risks };
  } catch {
    return { summary: item.body, next: "", risks: [] as string[] };
  }
}
