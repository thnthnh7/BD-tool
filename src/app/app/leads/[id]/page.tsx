import { requireModule } from "@/lib/auth/session";
import { Grid, GridCol, NativeSelect, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkAnchor } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActivityList, NoteForm } from "@/features/crm/components/activity-panel";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { getLead, qualifyLeadAction, updateLeadAction } from "@/features/leads/server/actions";
import { listPipelines } from "@/features/deals/server/actions";
import { listActivities } from "@/features/tasks/server/actions";
import { LEAD_STATUSES } from "@/lib/crm";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("leads");
  const { id } = await params;
  const [lead, companies, contacts, pipelineData, activities] = await Promise.all([
    getLead(id),
    listCompanies(),
    listContacts(),
    listPipelines(),
    listActivities({ leadId: id }),
  ]);
  if (!lead) notFound();
  const defaultPipeline = pipelineData.pipelines.find((item) => item.is_default) || pipelineData.pipelines[0];
  const stages = pipelineData.stages.filter((item) => item.pipeline_id === defaultPipeline?.id);

  return (
    <Stack gap="md">
      <PageHeader
        back={{ href: "/app/leads", label: "Leads" }}
        title={lead.contacts?.display_name || lead.companies?.name || "Lead"}
        subtitle={lead.source}
        action={<StatusBadge status={lead.status} />}
      />
      <Grid>
        <GridCol span={{ base: 12, lg: 7 }}>
          <Stack gap="md">
          <div data-tutorial-id="lead-detail-overview">
          <SectionPanel title="Lead">
            <ActionForm action={updateLeadAction}>
              <input type="hidden" name="id" value={lead.id} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <NativeSelect
                  name="company_id"
                  label="Company"
                  defaultValue={lead.company_id || ""}
                  data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
                />
                <NativeSelect
                  name="contact_id"
                  label="Contact"
                  defaultValue={lead.contact_id || ""}
                  data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
                />
                <NativeSelect name="status" label="Status" defaultValue={lead.status} data={LEAD_STATUSES.map((item) => ({ value: item, label: item }))} />
                <TextInput name="source" label="Source" defaultValue={lead.source} />
              </SimpleGrid>
            </ActionForm>
          </SectionPanel>
          </div>
          <div data-tutorial-id="lead-detail-qualify">
          <SectionPanel title="Qualify → Deal">
            <ActionForm action={qualifyLeadAction} submitLabel="Create deal" redirectTo="/app/deals/{id}">
              <input type="hidden" name="lead_id" value={lead.id} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <NativeSelect
                  name="company_id"
                  label="Company"
                  defaultValue={lead.company_id || ""}
                  data={companies.map((item) => ({ value: item.id, label: item.name }))}
                />
                <NativeSelect
                  name="contact_id"
                  label="Contact"
                  defaultValue={lead.contact_id || ""}
                  data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]}
                />
                <TextInput
                  name="title"
                  label="Deal title"
                  required
                  defaultValue={lead.companies?.name ? `${lead.companies.name} opportunity` : ""}
                  style={{ gridColumn: "1 / -1" }}
                />
                <NativeSelect
                  name="pipeline_id"
                  label="Pipeline"
                  defaultValue={defaultPipeline?.id}
                  data={pipelineData.pipelines.map((item) => ({ value: item.id, label: item.name }))}
                />
                <NativeSelect name="stage_id" label="Stage" data={stages.map((item) => ({ value: item.id, label: item.name }))} />
                <TextInput name="amount" type="number" label="Expected value" defaultValue="0" />
                <TextInput name="expected_close_date" type="date" label="Close date" />
              </SimpleGrid>
            </ActionForm>
          </SectionPanel>
          </div>
          </Stack>
        </GridCol>
        <GridCol span={{ base: 12, lg: 5 }}>
          <div data-tutorial-id="lead-detail-activity">
          <SectionPanel title="Activity" fill>
            <NoteForm leadId={lead.id} companyId={lead.company_id || undefined} contactId={lead.contact_id || undefined} />
            <ActivityList items={activities} />
            {lead.converted_deal_id ? (
              <Text size="sm" mt="md">
                Converted deal: <LinkAnchor href={`/app/deals/${lead.converted_deal_id}`}>{lead.converted_deal_id.slice(0, 8)}</LinkAnchor>
              </Text>
            ) : null}
          </SectionPanel>
          </div>
        </GridCol>
      </Grid>
    </Stack>
  );
}
