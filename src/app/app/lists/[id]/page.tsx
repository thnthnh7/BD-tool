import { NativeSelect, Stack, Text } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { notFound } from "next/navigation";
import { CompanyMark } from "@/components/leadely/company-mark";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { listLeads } from "@/features/leads/server/actions";
import { addListMemberAction, getLeadList, updateListMemberStatusAction } from "@/features/lists/server/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const { q, page } = readListQuery(await searchParams);
  const payload = await getLeadList(id);
  if (!payload) notFound();
  const [companies, contacts, leads] = await Promise.all([listCompanies(), listContacts(), listLeads()]);
  const matched = payload.members.filter((member) =>
    matchesQuery(q, [member.companies?.name, member.contacts?.display_name, member.contacts?.email, member.contacts?.job_title, member.status]),
  );
  const paged = slicePage(matched, page);
  const listPath = `/app/lists/${payload.list.id}`;

  return (
    <Stack gap="md">
      <PageHeader
        back={{ href: "/app/lists", label: "Lists" }}
        title={payload.list.name}
        subtitle={payload.list.description || payload.list.source}
        action={
          <>
            <LinkButton href={`/api/lists/${payload.list.id}/export?format=csv`} variant="light">
              CSV
            </LinkButton>
            <LinkButton href={`/api/lists/${payload.list.id}/export?format=xlsx`} variant="light">
              Excel
            </LinkButton>
          </>
        }
      />
      <SectionPanel title="Add member">
        <ActionForm action={addListMemberAction} submitLabel="Add">
          <input type="hidden" name="list_id" value={payload.list.id} />
          <NativeSelect name="company_id" label="Company" data={companies.map((item) => ({ value: item.id, label: item.name }))} />
          <NativeSelect
            name="contact_id"
            label="Contact"
            data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
          />
          <NativeSelect
            name="lead_id"
            label="Lead"
            data={[{ value: "", label: "—" }, ...leads.map((item) => ({ value: item.id, label: item.companies?.name || item.id.slice(0, 8) }))]}
          />
        </ActionForm>
      </SectionPanel>
      <SectionPanel
        title="Members"
        padded={paged.total === 0}
        action={<ListSearch path={listPath} q={q} placeholder="Công ty, contact, email hoặc trạng thái" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path={listPath} q={q} {...paged} singular="member" plural="members" />}>
        <Table>
          <TableThead>
            <TableTr>
              <TableTh>Company</TableTh>
              <TableTh>Contact</TableTh>
              <TableTh>Status</TableTh>
              <TableTh />
            </TableTr>
          </TableThead>
          <TableTbody>
            {paged.rows.map((member) => (
              <TableTr key={member.id}>
                <TableTd>
                  <LinkAnchor href={`/app/companies/${member.company_id}`} underline="never">
                    <CompanyMark name={member.companies?.name || "—"} logo={member.companies?.logo_path} />
                  </LinkAnchor>
                </TableTd>
                <TableTd>
                  <Text size="sm">{member.contacts?.display_name || "—"}</Text>
                  <Text size="xs" c="dimmed">
                    {member.contacts?.email || member.contacts?.job_title || ""}
                  </Text>
                </TableTd>
                <TableTd>
                  <StatusBadge status={member.status} />
                </TableTd>
                <TableTd>
                  <ActionForm action={updateListMemberStatusAction} submitLabel="Update">
                    <input type="hidden" name="id" value={member.id} />
                    <NativeSelect
                      name="status"
                      defaultValue={member.status}
                      data={["new", "contacted", "proposed", "won", "skipped"].map((item) => ({ value: item, label: item }))}
                    />
                  </ActionForm>
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
          </ListTable>
        ) : (
          <Text size="sm" c="dimmed">{q ? "Không thấy member khớp." : "Chưa có member nào."}</Text>
        )}
      </SectionPanel>
    </Stack>
  );
}
