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

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = readListQuery(await searchParams);
  const [leads, companies, contacts] = await Promise.all([listLeads(), listCompanies(), listContacts()]);
  const matched = leads.filter((lead) =>
    matchesQuery(q, [lead.contacts?.display_name, lead.companies?.name, lead.status, lead.source]),
  );
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader
        title="Leads"
        subtitle="Prospecting workflow — chưa phải Deal."
        action={
          <LinkButton href="/app/leads/sources" variant="light">
            Nguồn dữ liệu
          </LinkButton>
        }
      />
      <SectionPanel title="Add lead">
        <ActionForm action={createLeadAction} submitLabel="Create lead" redirectTo="/app/leads/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="company_id"
              label="Company"
              data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <NativeSelect
              name="contact_id"
              label="Contact"
              data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
            />
            <NativeSelect name="status" label="Status" data={LEAD_STATUSES.map((item) => ({ value: item, label: item }))} />
            <TextInput name="source" label="Source" defaultValue="manual" />
          </SimpleGrid>
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="All leads"
        padded={paged.total === 0}
        action={<ListSearch path="/app/leads" q={q} placeholder="Tên contact, công ty, trạng thái hoặc nguồn" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/leads" q={q} {...paged} singular="lead" plural="leads" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Lead</TableTh>
                <TableTh>Company</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Source</TableTh>
                <TableTh w={48} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((lead) => (
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
                    <LinkIcon href={`/app/leads/${lead.id}`} label={`Open ${lead.contacts?.display_name || lead.companies?.name || "lead"}`} />
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy lead khớp.</Text>
        ) : (
          <EmptyState icon={<UserPlus size={18} />} title="No leads" description="Tạo lead thủ công hoặc scrape Google Maps." />
        )}
      </SectionPanel>
    </Stack>
  );
}
