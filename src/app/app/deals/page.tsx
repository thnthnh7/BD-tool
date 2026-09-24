import { NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { BriefcaseBusiness } from "lucide-react";
import { DealBoard } from "@/features/deals/components/deal-board";
import { CompanyMark } from "@/components/leadely/company-mark";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { createDealAction, listDeals, listPipelines } from "@/features/deals/server/actions";
import { DEAL_PRIORITIES, DEAL_TYPES } from "@/lib/crm";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";
import { formatVnd } from "@/lib/money";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = readListQuery(await searchParams);
  const [deals, companies, contacts, pipelineData] = await Promise.all([
    listDeals(),
    listCompanies(),
    listContacts(),
    listPipelines(),
  ]);
  const matched = deals.filter((deal) =>
    matchesQuery(q, [deal.title, deal.companies?.name, deal.pipeline_stages?.name, deal.pipeline_stages?.stage_type, deal.amount]),
  );
  const paged = slicePage(matched, page);
  const defaultPipeline = pipelineData.pipelines.find((item) => item.is_default) || pipelineData.pipelines[0];
  const stages = pipelineData.stages
    .filter((item) => item.pipeline_id === defaultPipeline?.id)
    .sort((a, b) => a.position - b.position);

  return (
    <Stack gap="md">
      <PageHeader
        title="Deals"
        subtitle="Cơ hội thương mại — Kanban và bảng."
        action={<ListSearch path="/app/deals" q={q} placeholder="Tên deal, công ty hoặc stage" />}
      />
      <SectionPanel title="New deal">
        <ActionForm action={createDealAction} submitLabel="Create deal" redirectTo="/app/deals/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="title" label="Title" required style={{ gridColumn: "1 / -1" }} />
            <NativeSelect
              name="company_id"
              label="Company"
              data={companies.map((item) => ({ value: item.id, label: item.name }))}
            />
            <NativeSelect
              name="primary_contact_id"
              label="Primary contact"
              data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
            />
            <NativeSelect name="deal_type" label="Type" data={DEAL_TYPES.map((item) => ({ value: item, label: item }))} />
            <TextInput name="amount" type="number" label="Amount" defaultValue="0" />
            <NativeSelect name="priority" label="Priority" data={DEAL_PRIORITIES.map((item) => ({ value: item, label: item }))} />
            <TextInput name="expected_close_date" type="date" label="Expected close" />
          </SimpleGrid>
          <Textarea name="description" label="Description" />
        </ActionForm>
      </SectionPanel>

      <SectionPanel title="Kanban" padded={false}>
        <DealBoard stages={stages} deals={matched} />
      </SectionPanel>

      <SectionPanel title="Table" padded={paged.total === 0}>
        {paged.total ? (
          <ListTable
            footer={
              <ListFooter path="/app/deals" q={q} {...paged} singular="deal" plural="deals" />
            }
          >
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Deal</TableTh>
                <TableTh>Company</TableTh>
                <TableTh>Stage</TableTh>
                <TableTh ta="right">Amount</TableTh>
                <TableTh w={48} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((deal) => (
                <TableTr key={deal.id}>
                  <TableTd>
                    <Text fw={600} size="sm">
                      {deal.title}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <CompanyMark name={deal.companies?.name || "—"} logo={deal.companies?.logo_path} />
                  </TableTd>
                  <TableTd>
                    <StatusBadge status={deal.pipeline_stages?.name || deal.pipeline_stages?.stage_type || ""} />
                  </TableTd>
                  <TableTd ta="right">{formatVnd(deal.amount)}</TableTd>
                  <TableTd ta="right">
                    <LinkIcon href={`/app/deals/${deal.id}`} label={`Open ${deal.title}`} />
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy deal khớp.</Text>
        ) : (
          <EmptyState icon={<BriefcaseBusiness size={18} />} title="No deals" description="Qualify a lead hoặc tạo deal mới." />
        )}
      </SectionPanel>
    </Stack>
  );
}
