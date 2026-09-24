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
import { getScrapeJob, importScrapeResultsAction, refreshScrapeJobAction } from "@/features/leads/server/scrape-actions";
import { listSourceTitles } from "@/features/leads/server/source-actions";
import { scrapePlaceMatches } from "@/features/leads/scrape-match";
import { listLeadLists } from "@/features/lists/server/actions";
import { readListQuery, slicePage } from "@/lib/list-page";

function personLabel(person: { full_name: string | null; job_title: string | null; email: string | null; linkedin_url: string | null }) {
  return [person.full_name || "Unknown", person.job_title, person.email || person.linkedin_url].filter(Boolean).join(" · ");
}

export default async function ScrapeJobPage({ params, searchParams }: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ q?: string; page?: string; view?: string }>;
}) {
  const { jobId } = await params;
  const search = await searchParams;
  const { q, page } = readListQuery(search);
  const payload = await getScrapeJob(jobId);
  if (!payload) notFound();
  const generic = Boolean(payload.job.source_id) && !isMapsActor(payload.job.apify_actor_id);
  const [lists, sourceTitles] = await Promise.all([
    generic ? Promise.resolve([]) : listLeadLists(),
    listSourceTitles(payload.job.source_id ? [payload.job.source_id] : []),
  ]);
  const actorTitle = sourceTitles[0]?.title || (generic ? payload.job.apify_actor_id : "Google Maps Scraper");
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
  const timestamp = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
  const crm = generic ? undefined : (
      <SectionPanel title="Chọn địa điểm và liên hệ để import" padded={false}>
        <Box px="md" pt={4} pb="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <ListSearch path={jobPath} q={q} extra={{ view: "crm" }} placeholder="Tên, địa chỉ, website, SĐT hoặc người" />
            </Group>
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <Text size="sm" c="dimmed">
                Sẽ import {selectedPlaces.length} place · {importContacts} contact
              </Text>
              <ActionForm
                action={importScrapeResultsAction}
                submitLabel="Import vào CRM"
                redirectTo="/app/lists/{id}"
                redirectFallback="/app/companies"
                layout="inline"
              >
                <input type="hidden" name="job_id" value={payload.job.id} />
                <NativeSelect
                  name="list_id"
                  aria-label="List có sẵn"
                  data={[{ value: "", label: "List có sẵn" }, ...lists.map((item) => ({ value: item.id, label: item.name }))]}
                  w={200}
                />
                <TextInput name="list_name" aria-label="Hoặc tạo list mới" placeholder="Hoặc tạo list mới" w={200} />
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
                note={eligible.length ? `Đã chọn ${selectedPlaces.length}/${eligible.length} place` : "Đã import hết"}
              />
            }
          >
            <Table>
              <TableThead>
                <TableTr>
                  <TableTh w={48}>
                    <ScrapeHeaderCheckbox jobId={payload.job.id} query={q} eligible={eligible.length} selected={selectedPlaces.length} target="places" label="Chọn hết place đang lọc" />
                  </TableTh>
                  <TableTh>Place</TableTh>
                  <TableTh>Match</TableTh>
                  <TableTh>
                    <Group gap={8} wrap="nowrap">
                      <ScrapeHeaderCheckbox jobId={payload.job.id} query={q} eligible={eligiblePeople.length} selected={selectedPeople.length} target="people" label="Chọn hết người đang lọc" />
                      People
                    </Group>
                  </TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {paged.rows.map((result) => {
                  const imported = result.match_status === "imported";
                  const people = (peopleByResult.get(result.id) || []).map((person) => ({
                    id: person.id,
                    name: person.full_name || "Unknown",
                    label: personLabel(person),
                    selected: person.selected,
                  }));
                  return (
                    <TableTr key={result.id}>
                      <TableTd>
                        <ScrapeSelectCheckbox resultId={result.id} selected={result.selected} ariaLabel={`Import ${result.name}`} locked={imported} />
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
            {q ? "Không thấy place khớp." : "Chưa có place nào."}
          </Text>
        )}
      </SectionPanel>
  );
  return <Stack gap="md">
    <PageHeader back={{ href: "/app/leads/scrape", label: "Lịch sử scrape" }} title={payload.job.query || "Kết quả scrape"} subtitle={actorTitle}
      action={<Group gap="xs">
        {payload.job.apify_dataset_id && payload.job.status !== "ingesting" && <ActionForm action={refreshScrapeJobAction} submitLabel="Đồng bộ kết quả" variant="light"><input type="hidden" name="job_id" value={payload.job.id} /></ActionForm>}
        <LinkButton href={`/app/leads/scrape/new?rerun=${payload.job.id}`} variant="default">Chạy lại…</LinkButton>
      </Group>} />
    <Group gap="md"><ScrapeStatus status={payload.job.status} /><Text size="sm" c="dimmed">{rows.length.toLocaleString("vi-VN")} bản ghi đã nhận</Text><Text size="sm" c="dimmed">{timestamp(payload.job.created_at)}</Text></Group>
    {payload.job.error_message && <Alert color="red" title="Lần chạy gặp lỗi">{payload.job.error_message}</Alert>}
    {["running", "queued", "ingesting"].includes(payload.job.status) && <Alert color="blue">{payload.job.status === "ingesting" ? "Đang đồng bộ dữ liệu. Trang sẽ tự cập nhật khi hoàn tất." : "Đang chờ actor hoàn tất. Bạn có thể rời trang và quay lại, hoặc đồng bộ kết quả sau khi actor chạy xong."}</Alert>}
    <ScrapeJobTabs key={payload.job.id} status={payload.job.status} initialTab={!generic && (search.view === "crm" || q || page > 1) ? "crm" : "results"} crm={crm}
      results={<SectionPanel padded={false}><DatasetExplorer rows={rows} filename={`scrape-${payload.job.id}`} emptyMessage={payload.job.status === "succeeded" ? "Actor đã hoàn tất nhưng không trả về bản ghi nào." : undefined} /></SectionPanel>}
      input={<SectionPanel title="Thông số đã dùng"><Text size="sm" c="dimmed" mb="sm">Chạy lại sẽ mở form để bạn kiểm tra trước khi bắt đầu lượt mới.</Text><Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(input, null, 2)}</Code></SectionPanel>}
      processing={<SectionPanel title="Thông tin lần chạy"><SimpleGrid cols={{ base: 1, sm: 2 }}>
        {[["Actor", actorTitle], ["Run ID", payload.job.apify_run_id || "—"], ["Dataset ID", payload.job.apify_dataset_id || "—"], ["Bắt đầu", timestamp(payload.job.started_at)], ["Kết thúc", timestamp(payload.job.finished_at)], ["Khả năng CRM", generic ? "Chưa hỗ trợ import. Có thể xem và xuất dữ liệu." : "Import địa điểm và người liên hệ vào CRM."]].map(([label, value]) => <Box key={label}><Text size="xs" c="dimmed">{label}</Text><Text size="sm" style={{ overflowWrap: "anywhere" }}>{value}</Text></Box>)}
      </SimpleGrid></SectionPanel>} />
    {generic && <Text size="xs" c="dimmed">Dữ liệu từ actor được giữ riêng. Nguồn này chưa hỗ trợ import vào CRM.</Text>}
  </Stack>;
}
