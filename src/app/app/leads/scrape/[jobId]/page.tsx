import { requireModule } from "@/lib/auth/session";
import { Alert, Box, Code, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { notFound } from "next/navigation";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { DatasetExplorer } from "@/features/leads/components/dataset-explorer";
import { ScrapeJobTabs } from "@/features/leads/components/scrape-job-tabs";
import { ScrapeStatus } from "@/features/leads/components/scrape-status";
import { ScrapeSelectCheckbox } from "@/features/leads/components/scrape-select";
import { PlacePeople, ScrapeHeaderCheckbox } from "@/features/leads/components/scrape-places";
import { isMapsActor } from "@/features/leads/maps-source";
import { datasetRaw, type DatasetRow } from "@/features/leads/dataset";
import { cancelScrapeJobAction, getScrapeJob, importScrapeResultsAction, refreshScrapeJobAction } from "@/features/leads/server/scrape-actions";
import { listSourceTitles } from "@/features/leads/server/source-actions";
import { scrapePlaceMatches } from "@/features/leads/scrape-match";
import { listLeadLists } from "@/features/lists/server/actions";
import type { AppLocale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { readListQuery, slicePage } from "@/lib/list-page";
import { getLocale, getTranslations } from "next-intl/server";

function personLabel(person: { full_name: string | null; job_title: string | null; email: string | null; linkedin_url: string | null }, unknown: string) {
  return [person.full_name || unknown, person.job_title, person.email || person.linkedin_url].filter(Boolean).join(" · ");
}

export default async function ScrapeJobPage({ params, searchParams }: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ q?: string; page?: string; view?: string }>;
}) {
  const context = await requireModule("scraping");
  const [{ jobId }, search] = await Promise.all([params, searchParams]);
  const { q, page } = readListQuery(search);
  const [t, common, locale, payload] = await Promise.all([
    getTranslations("Scrape"),
    getTranslations("Common"),
    getLocale(),
    getScrapeJob(jobId),
  ]);
  const appLocale = locale as AppLocale;
  if (!payload) notFound();
  const generic = Boolean(payload.job.source_id) && !isMapsActor(payload.job.apify_actor_id);
  const [lists, sourceTitles] = await Promise.all([
    generic ? Promise.resolve([]) : listLeadLists(),
    listSourceTitles(payload.job.source_id ? [payload.job.source_id] : []),
  ]);
  const actorTitle = sourceTitles[0]?.title || (generic ? payload.job.apify_actor_id : "Google Maps Scraper");
  const canManage = context.memberRole !== "member";
  const peopleByResult = new Map<string, typeof payload.people>();
  for (const person of payload.people) {
    const current = peopleByResult.get(person.result_id) || [];
    current.push(person);
    peopleByResult.set(person.result_id, current);
  }
  const matched = payload.results.filter((result) => scrapePlaceMatches(q, result, peopleByResult.get(result.id) || []));
  const eligible = matched.filter((result) => result.match_status !== "imported");
  const selectedPlaces = eligible.filter((result) => result.selected);
  const eligiblePeople = eligible.flatMap((place) => peopleByResult.get(place.id) || []);
  const selectedPeople = eligiblePeople.filter((person) => person.selected);
  const importContacts = selectedPlaces.reduce((sum, place) => sum + (peopleByResult.get(place.id) || []).filter((person) => person.selected).length, 0);
  const paged = slicePage(matched, page);
  const jobPath = `/app/leads/scrape/${payload.job.id}`;
  const rows: DatasetRow[] = payload.results.map((result) => {
    const raw = datasetRaw(result.raw);
    const data = generic ? raw : {
      name: result.name, address: result.address, website: result.website, phone: result.phone,
      rating: result.rating, ...raw,
      people: raw.people ?? (peopleByResult.get(result.id) || []).map((person) => ({
        fullName: person.full_name, jobTitle: person.job_title, email: person.email, phone: person.phone,
        linkedinUrl: person.linkedin_url, ...datasetRaw(person.raw),
      })),
    };
    return { id: result.id, label: result.name, data };
  });
  const input = generic ? payload.job.filters : {
    query: payload.job.query, location: payload.job.location, language: payload.job.language,
    max_results: payload.job.max_results, enrich_people: payload.job.enrich_people,
    max_people_per_place: payload.job.max_people_per_place, verify_emails: payload.job.verify_emails,
  };
  const timestamp = (value: string | null) => value ? formatDate(value, appLocale, { dateStyle: "short", timeStyle: "medium" }) : "—";
  const creator = payload.job.creator?.display_name?.trim() || payload.job.creator?.email || "—";
  const apifyCost = payload.job.apify_usage_usd == null ? "—" : `$${Number(payload.job.apify_usage_usd).toFixed(4)} USD`;
  const crm = generic ? undefined : (
      <div data-tutorial-id="scrape-crm-import"><SectionPanel title={t("selectPlacesTitle")} padded={false}>
        <Box px="md" pt={4} pb="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <ListSearch path={jobPath} q={q} extra={{ view: "crm" }} placeholder={t("crmSearch")} submitLabel={common("search")} clearLabel={common("clear")} />
            </Group>
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <Text size="sm" c="dimmed">
                {t("importSummary", { places: selectedPlaces.length, contacts: importContacts })}
              </Text>
              <ActionForm
                action={importScrapeResultsAction}
                submitLabel={t("importCrm")}
                redirectTo="/app/lists/{id}"
                redirectFallback="/app/companies"
                layout="inline"
              >
                <input type="hidden" name="job_id" value={payload.job.id} />
                <NativeSelect
                  name="list_id"
                  aria-label={t("existingList")}
                  data={[{ value: "", label: t("existingList") }, ...lists.map((item) => ({ value: item.id, label: item.name }))]}
                  w={200}
                />
                <TextInput name="list_name" aria-label={t("newList")} placeholder={t("newList")} w={200} />
              </ActionForm>
            </Group>
          </Stack>
        </Box>
        {paged.total ? (
          <ListTable
            footer={
              <ListFooter
                path={jobPath}
                q={q}
                {...paged}
                singular="place"
                plural="places"
                ofLabel={common("of")}
                extra={{ view: "crm" }}
                note={eligible.length ? t("selectedPlaces", { selected: selectedPlaces.length, eligible: eligible.length }) : t("allImported")}
              />
            }
          >
            <Table>
              <TableThead>
                <TableTr>
                  <TableTh w={48}>
                    <ScrapeHeaderCheckbox jobId={payload.job.id} query={q} eligible={eligible.length} selected={selectedPlaces.length} target="places" label={t("selectAllPlaces")} />
                  </TableTh>
                  <TableTh>{t("place")}</TableTh>
                  <TableTh>{t("match")}</TableTh>
                  <TableTh>
                    <Group gap={8} wrap="nowrap">
                      <ScrapeHeaderCheckbox jobId={payload.job.id} query={q} eligible={eligiblePeople.length} selected={selectedPeople.length} target="people" label={t("selectAllPeople")} />
                      {t("people")}
                    </Group>
                  </TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {paged.rows.map((result) => {
                  const imported = result.match_status === "imported";
                  const people = (peopleByResult.get(result.id) || []).map((person) => ({
                    id: person.id,
                    name: person.full_name || t("unknownPerson"),
                    label: personLabel(person, t("unknownPerson")),
                    selected: person.selected,
                  }));
                  return (
                    <TableTr key={result.id}>
                      <TableTd>
                        <ScrapeSelectCheckbox resultId={result.id} selected={result.selected} ariaLabel={t("importNamed", { name: result.name })} locked={imported} />
                      </TableTd>
                      <TableTd>
                        <Text fw={600} size="sm">
                          {result.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {result.address || result.city || "—"}
                        </Text>
                        <Text size="xs">{result.website || result.phone || ""}</Text>
                      </TableTd>
                      <TableTd>
                        <StatusBadge status={result.match_status} />
                      </TableTd>
                      <TableTd>
                        <PlacePeople people={people} locked={imported} />
                      </TableTd>
                    </TableTr>
                  );
                })}
              </TableTbody>
            </Table>
          </ListTable>
        ) : (
          <Text size="sm" c="dimmed" px="md" pb="md">
            {q ? t("noPlaceMatch") : t("noPlaces")}
          </Text>
        )}
      </SectionPanel></div>
  );
  return <Stack gap="md">
    <PageHeader back={{ href: "/app/leads/scrape", label: t("historyBack") }} title={payload.job.query || t("resultsTitle")} subtitle={actorTitle}
      action={<Group gap="xs">
        {canManage && ["queued", "running"].includes(payload.job.status) && <ActionForm action={cancelScrapeJobAction} submitLabel={t("cancelRun")} variant="light"><input type="hidden" name="job_id" value={payload.job.id} /></ActionForm>}
        {payload.job.apify_dataset_id && !["ingesting", "canceled"].includes(payload.job.status) && <ActionForm action={refreshScrapeJobAction} submitLabel={t("syncResults")} variant="light"><input type="hidden" name="job_id" value={payload.job.id} /></ActionForm>}
        <LinkButton href={`/app/leads/scrape/new?rerun=${payload.job.id}`} variant="default">{t("rerun")}</LinkButton>
      </Group>} />
    <Group gap="md"><ScrapeStatus status={payload.job.status} /><Text size="sm" c="dimmed">{t("recordsCount", { count: rows.length })}</Text><Text size="sm" c="dimmed">{timestamp(payload.job.created_at)}</Text></Group>
    {payload.job.error_message && <Alert color="red" title={t("runFailed")}>{payload.job.error_message}</Alert>}
    {["running", "queued", "ingesting"].includes(payload.job.status) && <Alert color="blue">{payload.job.status === "ingesting" ? t("syncingData") : t("waitingActor")}</Alert>}
    <ScrapeJobTabs key={payload.job.id} status={payload.job.status} initialTab={!generic && (search.view === "crm" || q || page > 1) ? "crm" : "results"} crm={crm}
      results={<div data-tutorial-id="scrape-results"><SectionPanel padded={false}><DatasetExplorer rows={rows} filename={`scrape-${payload.job.id}`} emptyMessage={payload.job.status === "succeeded" ? t("emptyActor") : undefined} /></SectionPanel></div>}
      input={<SectionPanel title={t("inputUsed")}><Text size="sm" c="dimmed" mb="sm">{t("rerunHint")}</Text><Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(input, null, 2)}</Code></SectionPanel>}
      processing={<SectionPanel title={t("runInfo")}><SimpleGrid cols={{ base: 1, sm: 2 }}>
        {[[t("actor"), actorTitle], [t("runBy"), creator], [t("apifyCost"), apifyCost], [t("runId"), payload.job.apify_run_id || "—"], [t("datasetId"), payload.job.apify_dataset_id || "—"], [t("started"), timestamp(payload.job.started_at)], [t("finished"), timestamp(payload.job.finished_at)], [t("crmCapability"), generic ? t("crmUnsupportedDetail") : t("crmSupportedDetail")]].map(([label, value]) => <Box key={label}><Text size="xs" c="dimmed">{label}</Text><Text size="sm" style={{ overflowWrap: "anywhere" }}>{value}</Text></Box>)}
      </SimpleGrid></SectionPanel>} />
    {generic && <Text size="xs" c="dimmed">{t("genericStorageNote")}</Text>}
  </Stack>;
}
