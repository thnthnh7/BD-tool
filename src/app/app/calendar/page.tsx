import { Divider, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { CalendarDays } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { createMeetingAction, listMeetings, listIntegrations, upsertIntegrationAction } from "@/features/comms/server/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = readListQuery(await searchParams);
  const [meetings, companies, contacts, integrations] = await Promise.all([
    listMeetings(),
    listCompanies(),
    listContacts(),
    listIntegrations(),
  ]);
  const matched = meetings.filter((meeting) =>
    matchesQuery(q, [meeting.title, meeting.location, meeting.notes, (meeting.companies as { name?: string } | null)?.name]),
  );
  const paged = slicePage(matched, page);
  const calendarIntegrations = integrations.filter((item) => item.provider.includes("calendar"));
  return (
    <Stack gap="md">
      <PageHeader title="Calendar" subtitle="Meeting object workspace-scoped. Sync Google/Microsoft calendar ở bước OAuth sau." />
      <SectionPanel title="Calendar connections">
        <ActionForm action={upsertIntegrationAction} submitLabel="Save calendar intent">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="provider"
              label="Calendar"
              data={[
                { value: "google_calendar", label: "Google Calendar" },
                { value: "microsoft_calendar", label: "Microsoft Calendar" },
              ]}
            />
            <TextInput name="account_email" label="Account email" />
          </SimpleGrid>
        </ActionForm>
        {calendarIntegrations.length ? (
          <>
            <Divider my="md" />
            <Stack gap={4}>
              {calendarIntegrations.map((item) => (
                <Text key={item.id} size="sm" lineClamp={1}>
                  {item.provider} · {item.status}
                </Text>
              ))}
            </Stack>
          </>
        ) : null}
      </SectionPanel>
      <SectionPanel title="New meeting">
        <ActionForm action={createMeetingAction} submitLabel="Create meeting">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="title" label="Title" required style={{ gridColumn: "1 / -1" }} />
            <TextInput name="starts_at" type="datetime-local" label="Starts" required />
            <TextInput name="ends_at" type="datetime-local" label="Ends" />
            <TextInput name="location" label="Location" />
            <NativeSelect name="company_id" label="Company" data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]} />
            <NativeSelect name="contact_id" label="Contact" data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]} />
          </SimpleGrid>
          <Textarea name="notes" label="Notes" />
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="Upcoming"
        padded={paged.total === 0}
        action={<ListSearch path="/app/calendar" q={q} placeholder="Tiêu đề, địa điểm hoặc công ty" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/calendar" q={q} {...paged} singular="meeting" plural="meetings" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Meeting</TableTh>
                <TableTh style={{ whiteSpace: "nowrap" }}>When</TableTh>
                <TableTh>Company</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((meeting) => (
                <TableTr key={meeting.id}>
                  <TableTd>
                    <Text size="sm" lineClamp={1} maw={360}>
                      {meeting.title}
                    </Text>
                  </TableTd>
                  <TableTd style={{ whiteSpace: "nowrap" }}>{new Date(meeting.starts_at).toLocaleString("vi-VN")}</TableTd>
                  <TableTd>
                    <Text size="sm" lineClamp={1}>
                      {(meeting.companies as { name?: string } | null)?.name || "—"}
                    </Text>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy meeting khớp.</Text>
        ) : (
          <EmptyState icon={<CalendarDays size={18} />} title="No meetings" description="Tạo meeting để nó hiện trên dashboard hôm nay." />
        )}
      </SectionPanel>
    </Stack>
  );
}
