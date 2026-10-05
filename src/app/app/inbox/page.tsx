import { requireModule } from "@/lib/auth/session";
import { Divider, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Mail } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { listCommunications, listIntegrations, logCommunicationAction, upsertIntegrationAction } from "@/features/comms/server/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireModule("inbox");
  const { q, page } = readListQuery(await searchParams);
  const [items, companies, contacts, integrations] = await Promise.all([
    listCommunications(),
    listCompanies(),
    listContacts(),
    listIntegrations(),
  ]);
  const matched = items.filter((item) =>
    matchesQuery(q, [item.subject, item.direction, item.to_address, item.from_address, (item.companies as { name?: string } | null)?.name]),
  );
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader title="Inbox" subtitle="Gmail/Outlook OAuth sẽ gắn sau. Hiện log email thủ công vào timeline CRM." />
      <SectionPanel title="Mailbox connections">
        <ActionForm action={upsertIntegrationAction} submitLabel="Save mailbox intent">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="provider"
              label="Provider"
              data={[
                { value: "gmail", label: "Gmail" },
                { value: "outlook", label: "Outlook" },
              ]}
            />
            <TextInput name="account_email" label="Account email" />
          </SimpleGrid>
        </ActionForm>
        {integrations.length ? (
          <>
            <Divider my="md" />
            <Stack gap={4}>
              {integrations.map((item) => (
                <Text key={item.id} size="sm" lineClamp={1}>
                  {item.provider} · {item.status} · {item.account_email || "no account"}
                </Text>
              ))}
            </Stack>
          </>
        ) : null}
      </SectionPanel>
      <SectionPanel title="Log communication">
        <ActionForm action={logCommunicationAction} submitLabel="Log">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="subject" label="Subject" required style={{ gridColumn: "1 / -1" }} />
            <NativeSelect
              name="direction"
              label="Direction"
              data={[
                { value: "outbound", label: "Outbound" },
                { value: "inbound", label: "Inbound" },
              ]}
            />
            <TextInput name="to_address" label="To" />
            <NativeSelect name="company_id" label="Company" data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]} />
            <NativeSelect name="contact_id" label="Contact" data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]} />
          </SimpleGrid>
          <Textarea name="body" label="Body" minRows={4} />
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="Recent"
        padded={paged.total === 0}
        action={<ListSearch path="/app/inbox" q={q} placeholder="Subject, người nhận, chiều hoặc công ty" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/inbox" q={q} {...paged} singular="email" plural="emails" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Subject</TableTh>
                <TableTh>Direction</TableTh>
                <TableTh>Company</TableTh>
                <TableTh style={{ whiteSpace: "nowrap" }}>When</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((item) => (
                <TableTr key={item.id}>
                  <TableTd>
                    <Text size="sm" lineClamp={1} maw={320}>
                      {item.subject}
                    </Text>
                  </TableTd>
                  <TableTd>{item.direction}</TableTd>
                  <TableTd>
                    <Text size="sm" lineClamp={1}>
                      {(item.companies as { name?: string } | null)?.name || "—"}
                    </Text>
                  </TableTd>
                  <TableTd style={{ whiteSpace: "nowrap" }}>{new Date(item.occurred_at).toLocaleString("vi-VN")}</TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy email khớp.</Text>
        ) : (
          <EmptyState icon={<Mail size={18} />} title="No communications" description="Log email đầu tiên để nó xuất hiện trong timeline CRM." />
        )}
      </SectionPanel>
    </Stack>
  );
}
