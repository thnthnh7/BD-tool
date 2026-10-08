import { requireModule } from "@/lib/auth/session";
import { NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { CalendarDays } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { createMeetingAction, listMeetings } from "@/features/comms/server/actions";
import { listEngagementAccounts } from "@/features/comms/server/accounts";
import { EngagementAccountsPanel } from "@/features/comms/components/engagement-accounts-panel";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; oauth?: string }> }) {
  await requireModule("calendar");
  const input = await searchParams;
  const { q, page } = readListQuery(input);
  const [meetings, companies, contacts, accounts] = await Promise.all([
    listMeetings(),
    listCompanies(),
    listContacts(),
    listEngagementAccounts(),
  ]);
  const matched = meetings.filter((meeting) =>
    matchesQuery(q, [meeting.title, meeting.location, meeting.notes, (meeting.companies as { name?: string } | null)?.name]),
  );
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader title="Calendar" subtitle="Create meetings and prepare two-way Google or Microsoft calendar sync." />
      <SectionPanel title="Calendar connections">
        <EngagementAccountsPanel accounts={accounts} oauthStatus={input.oauth} />
      </SectionPanel>
      <SectionPanel title="New meeting">
        <ActionForm action={createMeetingAction} submitLabel="Create meeting">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="account_id"
              label="Calendar account"
              data={[{ value: "", label: "Local meeting only" }, ...accounts.filter((item) => item.status === "connected").map((item) => ({ value: item.id, label: `${item.account_email} (${item.provider})` }))]}
            />
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
