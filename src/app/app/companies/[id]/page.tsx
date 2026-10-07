import { requireModule } from "@/lib/auth/session";
import { Grid, GridCol, NativeSelect, SimpleGrid, Stack, TextInput, Textarea } from "@mantine/core";
import { BriefcaseBusiness, Users } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/leadely/empty-state";
import { LogoField } from "@/components/leadely/logo-field";
import { clientInitials } from "@/lib/image";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActivityList, NoteForm } from "@/features/crm/components/activity-panel";
import {
  getCompany,
  listCompanyContacts,
  listCompanyDeals,
  updateCompanyAction,
} from "@/features/companies/server/actions";
import { listActivities } from "@/features/tasks/server/actions";
import { LIFECYCLE_STAGES } from "@/lib/crm";
import { getAccountPlan, upsertAccountPlanAction } from "@/features/comms/server/actions";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("companies");
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  const [contacts, deals, activities, accountPlan] = await Promise.all([
    listCompanyContacts(id),
    listCompanyDeals(id),
    listActivities({ companyId: id }),
    getAccountPlan(id),
  ]);

  return (
    <Stack gap="md">
      <PageHeader
        back={{ href: "/app/companies", label: "Companies" }}
        title={company.name}
        mark={{ src: company.logo_path, initials: clientInitials(company.name) }}
        subtitle={[company.industry, company.website].filter(Boolean).join(" · ")}
        action={
          <LinkButton href={`/app/deals?companyId=${company.id}`} variant="light">
            Create deal
          </LinkButton>
        }
      />
      <Grid>
        <GridCol span={{ base: 12, lg: 7 }}>
          <div data-tutorial-id="company-detail-overview">
          <SectionPanel title="Overview">
            <ActionForm action={updateCompanyAction} submitLabel="Save company">
              <input type="hidden" name="id" value={company.id} />
              <LogoField initialUrl={company.logo_path} fallbackName={company.name} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput name="name" label="Name" defaultValue={company.name} required />
                <NativeSelect
                  name="lifecycle_stage"
                  label="Lifecycle"
                  defaultValue={company.lifecycle_stage}
                  data={LIFECYCLE_STAGES.map((item) => ({ value: item, label: item }))}
                />
                <TextInput name="industry" label="Industry" defaultValue={company.industry} />
                <TextInput name="website" label="Website" defaultValue={company.website} />
                <TextInput name="domain" label="Domain" defaultValue={company.domain} />
                <TextInput name="email" label="Email" defaultValue={company.email} />
                <TextInput name="phone" label="Phone" defaultValue={company.phone} />
                <TextInput name="tax_code" label="Tax code" defaultValue={company.tax_code} />
                <TextInput name="address" label="Address" defaultValue={company.address} />
                <TextInput name="lead_source" label="Source" defaultValue={company.lead_source} />
              </SimpleGrid>
              <Textarea name="notes" label="Notes" defaultValue={company.notes} />
            </ActionForm>
          </SectionPanel>
          </div>
        </GridCol>
        <GridCol span={{ base: 12, lg: 5 }}>
          <div data-tutorial-id="company-detail-activity">
          <SectionPanel title="Activity" fill>
            <NoteForm companyId={company.id} />
            <ActivityList items={activities} />
          </SectionPanel>
          </div>
        </GridCol>
      </Grid>
      <Grid data-tutorial-id="company-detail-relations">
        <GridCol span={{ base: 12, md: 6 }}>
          <SectionPanel title="Contacts" fill action={<LinkAnchor href="/app/contacts" size="sm">All</LinkAnchor>}>
            {contacts.length ? (
              <Stack gap="xs">
                {contacts.map((contact) => (
                  <LinkAnchor key={contact.id} href={`/app/contacts/${contact.id}`} lineClamp={1}>
                    {contact.display_name} · {contact.job_title || contact.email}
                  </LinkAnchor>
                ))}
              </Stack>
            ) : (
              <EmptyState compact icon={<Users size={14} />} title="No contacts" description="Thêm contact để theo dõi người liên hệ." />
            )}
          </SectionPanel>
        </GridCol>
        <GridCol span={{ base: 12, md: 6 }}>
          <SectionPanel title="Deals" fill padded={deals.length === 0}>
            {deals.length ? (
              <Table>
                <TableThead>
                  <TableTr>
                    <TableTh>Deal</TableTh>
                    <TableTh>Stage</TableTh>
                  </TableTr>
                </TableThead>
                <TableTbody>
                  {deals.map((deal) => (
                    <TableTr key={deal.id}>
                      <TableTd>
                        <LinkAnchor href={`/app/deals/${deal.id}`} lineClamp={1}>
                          {deal.title}
                        </LinkAnchor>
                      </TableTd>
                      <TableTd>{deal.pipeline_stages?.name || ""}</TableTd>
                    </TableTr>
                  ))}
                </TableTbody>
              </Table>
            ) : (
              <EmptyState compact icon={<BriefcaseBusiness size={14} />} title="No deals" description="Tạo deal từ nút Create deal ở trên." />
            )}
          </SectionPanel>
        </GridCol>
      </Grid>
      <div data-tutorial-id="company-detail-plan">
      <SectionPanel title="Account plan">
        <ActionForm action={upsertAccountPlanAction} submitLabel="Save plan">
          <input type="hidden" name="company_id" value={company.id} />
          <Textarea name="objective" label="Objective" defaultValue={accountPlan?.objective || ""} minRows={2} />
          <Textarea name="strategy" label="Strategy" defaultValue={accountPlan?.strategy || ""} minRows={3} />
          <Textarea name="risks" label="Risks" defaultValue={accountPlan?.risks || ""} minRows={2} />
          <TextInput name="next_review_at" type="date" label="Next review" defaultValue={accountPlan?.next_review_at || ""} />
        </ActionForm>
      </SectionPanel>
      </div>
    </Stack>
  );
}
