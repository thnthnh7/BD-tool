import { requireModule } from "@/lib/auth/session";
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
import { DEAL_CURRENCIES, formatCurrency } from "@/lib/money";
import { getTranslations } from "next-intl/server";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireModule("deals");
  const t = await getTranslations("Deals");
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
        title={t("title")}
        subtitle={t("subtitle")}
        action={<ListSearch path="/app/deals" q={q} placeholder={t("searchPlaceholder")} />}
      />
      <SectionPanel title={t("newDeal")}>
        <ActionForm action={createDealAction} submitLabel={t("createDeal")} redirectTo="/app/deals/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="title" label={t("dealTitle")} required style={{ gridColumn: "1 / -1" }} />
            <NativeSelect
              name="company_id"
              label={t("company")}
              data={companies.map((item) => ({ value: item.id, label: item.name }))}
            />
            <NativeSelect
              name="primary_contact_id"
              label={t("primaryContact")}
              data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
            />
            <NativeSelect name="deal_type" label={t("type")} data={DEAL_TYPES.map((item) => ({ value: item, label: item }))} />
            <SimpleGrid cols={2} spacing="xs">
              <TextInput name="amount" type="number" label={t("amount")} defaultValue="0" min={0} />
              <NativeSelect name="currency" label="Currency" defaultValue="VND" data={DEAL_CURRENCIES.map((item) => ({ value: item, label: item }))} />
            </SimpleGrid>
            <NativeSelect name="priority" label={t("priority")} data={DEAL_PRIORITIES.map((item) => ({ value: item, label: item }))} />
            <TextInput name="expected_close_date" type="date" label={t("expectedClose")} />
          </SimpleGrid>
          <Textarea name="description" label={t("description")} />
        </ActionForm>
      </SectionPanel>

      <SectionPanel title={t("kanban")} padded={false}>
        <DealBoard stages={stages} deals={matched} />
      </SectionPanel>

      <SectionPanel title={t("table")} padded={paged.total === 0}>
        {paged.total ? (
          <ListTable
            footer={
              <ListFooter path="/app/deals" q={q} {...paged} singular={t("item")} plural={t("items")} />
            }
          >
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>{t("deal")}</TableTh>
                <TableTh>{t("company")}</TableTh>
                <TableTh>{t("stage")}</TableTh>
                <TableTh ta="right">{t("amount")}</TableTh>
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
                  <TableTd ta="right">{formatCurrency(deal.amount, deal.currency)}</TableTd>
                  <TableTd ta="right">
                    <LinkIcon href={`/app/deals/${deal.id}`} label={t("openDeal", { name: deal.title })} />
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">{t("noMatches")}</Text>
        ) : (
          <EmptyState icon={<BriefcaseBusiness size={18} />} title={t("emptyTitle")} description={t("emptyDescription")} />
        )}
      </SectionPanel>
    </Stack>
  );
}
