import { Badge, Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { ArrowUpRight, Plus, Radar, Search } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import { ScrapeStatus } from "@/features/leads/components/scrape-status";
import { isMapsActor, MAPS_SLUG } from "@/features/leads/maps-source";
import { listInstalledSources, listSourceTitles } from "@/features/leads/server/source-actions";
import { listScrapeJobs } from "@/features/leads/server/scrape-actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { getLocale, getTranslations } from "next-intl/server";

function jobSourceName(job: { source_id: string | null; apify_actor_id: string | null }, titles: Map<string, string>, legacySource: string) {
  if (job.source_id && titles.has(job.source_id)) return titles.get(job.source_id)!;
  if (isMapsActor(job.apify_actor_id) || job.apify_actor_id === "demo") return "Google Maps Scraper";
  return job.apify_actor_id || legacySource;
}

export default async function LeadScrapePage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; source?: string; status?: string; period?: string }>;
}) {
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("Scrape"), getLocale()]);
  const { q, page } = readListQuery(params);
  const [jobs, sources, apify] = await Promise.all([listScrapeJobs(), listInstalledSources(), getCurrentWorkspaceApifyStatus()]);
  const extraTitles = await listSourceTitles(jobs.map((job) => job.source_id).filter((id): id is string => Boolean(id)));
  const titles = new Map([...sources.map((source) => [source.id, source.title] as const), ...extraTitles.map((source) => [source.id, source.title] as const)]);
  const actorOptions = new Map<string, string>(sources.map((source) => [source.id, source.title]));
  const actorKey = (job: (typeof jobs)[number]) => job.source_id || sources.find((item) =>
    item.slug === (job.apify_actor_id === "demo" ? MAPS_SLUG : job.apify_actor_id.replaceAll("~", "/")))?.id || job.apify_actor_id;
  for (const job of jobs) actorOptions.set(actorKey(job), jobSourceName(job, titles, t("legacySource")));
  const source = actorOptions.has(params.source || "") ? params.source! : "";
  const statuses = ["queued", "running", "ingesting", "succeeded", "failed", "canceled"];
  const status = statuses.includes(params.status || "") ? params.status! : "";
  const period = ["7", "30", "90"].includes(params.period || "") ? params.period! : "";
  const cutoff = period ? new Date().getTime() - Number(period) * 86400000 : 0;
  const matched = jobs.filter((job) => (!source || actorKey(job) === source)
    && (!status || job.status === status) && (!cutoff || new Date(job.created_at).getTime() >= cutoff)
    && matchesQuery(q, [job.query, job.location, jobSourceName(job, titles, t("legacySource"))]));
  const paged = slicePage(matched, page);
  const extra = { source, status, period };
  const active = jobs.filter((job) => ["queued", "running", "ingesting"].includes(job.status)).length;
  const filtered = Boolean(q || source || status || period);

  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle")}
      action={<Group gap="xs"><LinkButton href="/app/leads/sources" variant="default">{t("sources")}</LinkButton><LinkButton href="/app/leads/scrape/new" leftSection={<Plus size={16} />}>{t("newRun")}</LinkButton></Group>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact />
    <Group gap="sm"><Badge variant="light" color="gray">{t("installedCount", { count: sources.length })}</Badge><Badge variant="light" color="gray">{t("runCount", { count: jobs.length })}</Badge>{active > 0 && <Badge variant="light" color="teal">{t("activeCount", { count: active })}</Badge>}</Group>
    <SectionPanel title={t("history")} padded={false}>
      <form action="/app/leads/scrape">
        <Group gap="sm" p="md" align="flex-end">
          <TextInput name="q" defaultValue={q} placeholder={t("search")} aria-label={t("searchLabel")} leftSection={<Search size={15} />} style={{ flex: 1, minWidth: 180 }} />
          <NativeSelect name="source" aria-label={t("actorFilter")} defaultValue={source} w={240} data={[{ value: "", label: t("allActors") }, ...[...actorOptions].map(([value, label]) => ({ value, label }))]} />
          <NativeSelect name="status" aria-label={t("statusFilter")} defaultValue={status} w={165} data={[{ value: "", label: t("allStatuses") }, ...statuses.map((value) => ({ value, label: t(value) }))]} />
          <NativeSelect name="period" aria-label={t("periodFilter")} defaultValue={period} w={145} data={[{ value: "", label: t("allPeriods") }, ...[7, 30, 90].map((count) => ({ value: String(count), label: t("lastDays", { count }) }))]} />
          <Button type="submit" variant="light">{t("filter")}</Button>{filtered && <LinkAnchor href="/app/leads/scrape" size="sm">{t("clearFilters")}</LinkAnchor>}
        </Group>
      </form>
      {paged.total ? <ListTable footer={<ListFooter path="/app/leads/scrape" q={q} extra={extra} {...paged} singular={t("item")} plural={t("items")} ofLabel={locale === "vi" ? "của" : "of"} />}>
        <Table miw={850}><TableThead><TableTr><TableTh>{t("run")}</TableTh><TableTh>{t("actor")}</TableTh><TableTh>{t("status")}</TableTh><TableTh ta="right">{t("recordsReceived")}</TableTh><TableTh>{t("createdAt")}</TableTh><TableTh /></TableTr></TableThead>
          <TableTbody>{paged.rows.map((job) => <TableTr key={job.id}>
            <TableTd maw={320}><LinkAnchor href={`/app/leads/scrape/${job.id}`} fw={600} size="sm" lineClamp={2}>{job.query || t("defaultRunName")}</LinkAnchor>{job.location && <Text size="xs" c="dimmed">{job.location}</Text>}</TableTd>
            <TableTd maw={220}><Text size="sm" lineClamp={2}>{jobSourceName(job, titles, t("legacySource"))}</Text></TableTd>
            <TableTd><ScrapeStatus status={job.status} /></TableTd>
            <TableTd ta="right"><Text size="sm" fw={600}>{job.places_found.toLocaleString(locale)}</Text>{job.people_found > 0 && <Text size="xs" c="dimmed">{t("contactsAdded", { count: job.people_found })}</Text>}</TableTd>
            <TableTd><Text size="xs" c="dimmed">{new Date(job.created_at).toLocaleString(locale, { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}</Text></TableTd>
            <TableTd><LinkButton size="compact-sm" variant="subtle" href={`/app/leads/scrape/${job.id}`} rightSection={<ArrowUpRight size={14} />}>{t("open")}</LinkButton></TableTd>
          </TableTr>)}</TableTbody>
        </Table>
      </ListTable> : <Stack p="xl"><EmptyState icon={<Radar size={20} />} title={filtered ? t("noMatches") : t("startTitle")} description={filtered ? t("noMatchesHelp") : t("startHelp")} />{!filtered && <LinkButton href="/app/leads/scrape/new" w="fit-content">{t("newRun")}</LinkButton>}</Stack>}
    </SectionPanel>
  </Stack>;
}
