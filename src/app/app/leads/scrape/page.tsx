import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { ArrowUpRight, Plus, Radar, Search } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import { ScrapeStatus } from "@/features/leads/components/scrape-status";
import { isMapsActor } from "@/features/leads/maps-source";
import { listScrapeHistory } from "@/features/leads/server/scrape-history";
import Form from "next/form";
import { readListQuery } from "@/lib/list-page";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { getLocale, getTranslations } from "next-intl/server";

function jobSourceName(job: { source_id: string | null; apify_actor_id: string | null }, titles: Map<string, string>, legacySource: string) {
  if (job.source_id && titles.has(job.source_id)) return titles.get(job.source_id)!;
  if (isMapsActor(job.apify_actor_id) || job.apify_actor_id === "demo") return "Google Maps Scraper";
  return job.apify_actor_id || legacySource;
}

function creatorLabel(job: { creator: { display_name: string | null; email: string } | null }) {
  return job.creator?.display_name?.trim() || job.creator?.email || "—";
}

export default async function LeadScrapePage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; source?: string; status?: string; period?: string }>;
}) {
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("Scrape"), getLocale()]);
  const { q, page } = readListQuery(params);
  const [history, apify] = await Promise.all([
    listScrapeHistory({ ...params, q, page }, t("legacySource")), getCurrentWorkspaceApifyStatus(),
  ]);
  const { sources, titles, actorOptions, source, status, period, statuses, paged, summary } = history;
  const extra = { source, status, period };
  const active = summary.active;
  const filtered = Boolean(q || source || status || period);

  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle")}
      action={<Group gap="xs"><LinkButton href="/app/leads/sources" variant="default">{t("sources")}</LinkButton><LinkButton href="/app/leads/scrape/new" leftSection={<Plus size={16} />}>{t("newRun")}</LinkButton></Group>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact
      activitySummary={[t("installedCount", { count: sources.length }), t("runCount", { count: summary.total }), ...(active > 0 ? [t("activeCount", { count: active })] : [])]} />
    <SectionPanel title={t("history")} padded={false}>
      <Form key={`${q}:${source}:${status}:${period}`} action="/app/leads/scrape" prefetch={false}>
        <Group gap="sm" p="md" align="flex-end">
          <TextInput name="q" defaultValue={q} placeholder={t("search")} aria-label={t("searchLabel")} leftSection={<Search size={15} />} style={{ flex: 1, minWidth: 180 }} />
          <NativeSelect name="source" aria-label={t("actorFilter")} defaultValue={source} w={240} data={[{ value: "", label: t("allActors") }, ...[...actorOptions].map(([value, label]) => ({ value, label }))]} />
          <NativeSelect name="status" aria-label={t("statusFilter")} defaultValue={status} w={165} data={[{ value: "", label: t("allStatuses") }, ...statuses.map((value) => ({ value, label: t(value) }))]} />
          <NativeSelect name="period" aria-label={t("periodFilter")} defaultValue={period} w={145} data={[{ value: "", label: t("allPeriods") }, ...[7, 30, 90].map((count) => ({ value: String(count), label: t("lastDays", { count }) }))]} />
          <Button type="submit" variant="light">{t("filter")}</Button>{filtered && <LinkAnchor href="/app/leads/scrape" size="sm">{t("clearFilters")}</LinkAnchor>}
        </Group>
      </Form>
      {paged.total ? <ListTable footer={<ListFooter path="/app/leads/scrape" q={q} extra={extra} {...paged} singular={t("item")} plural={t("items")} ofLabel={locale === "vi" ? "của" : "of"} />}>
        <Table miw={1050}><TableThead><TableTr><TableTh>{t("run")}</TableTh><TableTh>{t("actor")}</TableTh><TableTh>{t("runBy")}</TableTh><TableTh>{t("status")}</TableTh><TableTh ta="right">{t("recordsReceived")}</TableTh><TableTh ta="right">{t("apifyCost")}</TableTh><TableTh>{t("createdAt")}</TableTh><TableTh /></TableTr></TableThead>
          <TableTbody>{paged.rows.map((job) => <TableTr key={job.id}>
            <TableTd maw={320}><LinkAnchor href={`/app/leads/scrape/${job.id}`} fw={600} size="sm" lineClamp={2}>{job.query || t("defaultRunName")}</LinkAnchor>{job.location && <Text size="xs" c="dimmed">{job.location}</Text>}</TableTd>
            <TableTd maw={220}><Text size="sm" lineClamp={2}>{jobSourceName(job, titles, t("legacySource"))}</Text></TableTd>
            <TableTd maw={190}><Text size="sm" lineClamp={1}>{creatorLabel(job)}</Text>{job.creator?.display_name && <Text size="xs" c="dimmed" lineClamp={1}>{job.creator.email}</Text>}</TableTd>
            <TableTd><ScrapeStatus status={job.status} /></TableTd>
            <TableTd ta="right"><Text size="sm" fw={600}>{job.places_found.toLocaleString(locale)}</Text>{job.people_found > 0 && <Text size="xs" c="dimmed">{t("contactsAdded", { count: job.people_found })}</Text>}</TableTd>
            <TableTd ta="right"><Text size="sm">{job.apify_usage_usd == null ? "—" : `$${Number(job.apify_usage_usd).toFixed(4)}`}</Text></TableTd>
            <TableTd><Text size="xs" c="dimmed">{new Date(job.created_at).toLocaleString(locale, { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}</Text></TableTd>
            <TableTd><LinkButton size="compact-sm" variant="subtle" href={`/app/leads/scrape/${job.id}`} rightSection={<ArrowUpRight size={14} />}>{t("open")}</LinkButton></TableTd>
          </TableTr>)}</TableTbody>
        </Table>
      </ListTable> : <Stack p="xl"><EmptyState icon={<Radar size={20} />} title={filtered ? t("noMatches") : t("startTitle")} description={filtered ? t("noMatchesHelp") : t("startHelp")} />{!filtered && <LinkButton href="/app/leads/scrape/new" w="fit-content">{t("newRun")}</LinkButton>}</Stack>}
    </SectionPanel>
  </Stack>;
}
