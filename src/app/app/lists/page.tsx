import { Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { ListFilter } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { createLeadListAction, listLeadLists } from "@/features/lists/server/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = readListQuery(await searchParams);
  const lists = await listLeadLists();
  const matched = lists.filter((list) => matchesQuery(q, [list.name, list.description, list.source, list.status]));
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader title="Lead lists" subtitle="Working set độc lập với scrape job. Export CSV / Excel." />
      <SectionPanel title="New list">
        <ActionForm action={createLeadListAction} submitLabel="Create list" redirectTo="/app/lists/{id}">
          <TextInput name="name" label="Name" required maw={420} />
          <Textarea name="description" label="Description" />
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="All lists"
        padded={paged.total === 0}
        action={<ListSearch path="/app/lists" q={q} placeholder="Tên, mô tả, nguồn hoặc trạng thái" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/lists" q={q} {...paged} singular="list" plural="lists" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Name</TableTh>
                <TableTh>Source</TableTh>
                <TableTh>Status</TableTh>
                <TableTh w={48} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((list) => (
                <TableTr key={list.id}>
                  <TableTd>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {list.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2} maw={420}>
                      {list.description}
                    </Text>
                  </TableTd>
                  <TableTd>{list.source}</TableTd>
                  <TableTd>
                    <StatusBadge status={list.status} />
                  </TableTd>
                  <TableTd ta="right">
                    <LinkIcon href={`/app/lists/${list.id}`} label={`Open ${list.name}`} />
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy list khớp.</Text>
        ) : (
          <EmptyState icon={<ListFilter size={18} />} title="No lists" description="Tạo list thủ công hoặc import từ Maps scrape." />
        )}
      </SectionPanel>
    </Stack>
  );
}
