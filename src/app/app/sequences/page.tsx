import { Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Mail } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { createSequenceAction, listSequences } from "@/features/comms/server/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function SequencesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = readListQuery(await searchParams);
  const sequences = await listSequences();
  const matched = sequences.filter((item) => matchesQuery(q, [item.name, item.description, item.status]));
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader title="Sequences" subtitle="Outbound cadences. Bước gửi thật qua Gmail hoãn đến khi mailbox connected." />
      <SectionPanel title="New sequence">
        <ActionForm action={createSequenceAction} submitLabel="Create" redirectTo="/app/sequences/{id}">
          <TextInput name="name" label="Name" required />
          <Textarea name="description" label="Description" />
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="All sequences"
        padded={paged.total === 0}
        action={<ListSearch path="/app/sequences" q={q} placeholder="Tên, mô tả hoặc trạng thái" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/sequences" q={q} {...paged} singular="sequence" plural="sequences" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Name</TableTh>
                <TableTh>Status</TableTh>
                <TableTh w={48} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((item) => (
                <TableTr key={item.id}>
                  <TableTd>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2} maw={420}>
                      {item.description}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <StatusBadge status={item.status} />
                  </TableTd>
                  <TableTd ta="right">
                    <LinkIcon href={`/app/sequences/${item.id}`} label={`Open ${item.name}`} />
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy sequence khớp.</Text>
        ) : (
          <EmptyState icon={<Mail size={18} />} title="No sequences" description="Tạo cadence đầu tiên để chuẩn bị outbound." />
        )}
      </SectionPanel>
    </Stack>
  );
}
