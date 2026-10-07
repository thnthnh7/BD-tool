import { requireModule } from "@/lib/auth/session";
import { NativeSelect, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { UserPlus } from "lucide-react";
import { CompanyMark } from "@/components/leadely/company-mark";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkButton, LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { createLeadAction, listLeads } from "@/features/leads/server/actions";
import { LEAD_STATUSES } from "@/lib/crm";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";
import { getTranslations } from "next-intl/server";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireModule("leads");
  const t = await getTranslations("CRM");
  const { q, page } = readListQuery(await searchParams);
  const [leads, companies, contacts] = await Promise.all([listLeads(), listCompanies(), listContacts()]);
  const matched = leads.filter((lead) =>
    matchesQuery(q, [lead.contacts?.display_name, lead.companies?.name, lead.status, lead.source]),
  );
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader
        title={t("leadsTitle")}
        subtitle={t("leadsSubtitle")}
        action={
          <LinkButton href="/app/leads/sources" variant="light">
            {t("dataSources")}
          </LinkButton>
        }
      />
      <SectionPanel title={t("addLead")}>
        <ActionForm action={createLeadAction} submitLabel={t("createLead")} redirectTo="/app/leads/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="company_id"
              label={t("company")}
              data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <NativeSelect
              name="contact_id"
              label={t("contact")}
              data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
            />
            <NativeSelect name="status" label={t("status")} data={LEAD_STATUSES.map((item) => ({ value: item, label: item }))} />
            <TextInput name="source" label={t("source")} defaultValue="manual" />
          </SimpleGrid>
        </ActionForm>
      </SectionPanel>
      <div data-tutorial-id="leads-list">
      <SectionPanel
        title={t("allLeads")}
        padded={paged.total === 0}
        action={<ListSearch path="/app/leads" q={q} placeholder={t("leadSearch")} />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/leads" q={q} {...paged} singular={t("lead")} plural={t("lead")} />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>{t("lead")}</TableTh>
                <TableTh>{t("company")}</TableTh>
                <TableTh>{t("status")}</TableTh>
                <TableTh>{t("source")}</TableTh>
                <TableTh w={48} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((lead, index) => (
                <TableTr key={lead.id}>
                  <TableTd>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {lead.contacts?.display_name || lead.companies?.name || lead.id.slice(0, 8)}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <CompanyMark name={lead.companies?.name || "—"} logo={lead.companies?.logo_path} />
                  </TableTd>
                  <TableTd>
                    <StatusBadge status={lead.status} />
                  </TableTd>
                  <TableTd>{lead.source}</TableTd>
                  <TableTd ta="right">
                    <span data-tutorial-id={index === 0 ? "tutorial-open-first-lead" : undefined}>
                      <LinkIcon href={`/app/leads/${lead.id}`} label={t("openRecord", { name: lead.contacts?.display_name || lead.companies?.name || t("lead") })} />
                    </span>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">{t("noLeadMatches")}</Text>
        ) : (
          <EmptyState icon={<UserPlus size={18} />} title={t("noLeads")} description={t("noLeadsHelp")} />
        )}
      </SectionPanel>
      </div>
    </Stack>
  );
}
