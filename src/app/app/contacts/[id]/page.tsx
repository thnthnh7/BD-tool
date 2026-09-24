import { Grid, GridCol, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { notFound } from "next/navigation";
import { CompanyMark } from "@/components/leadely/company-mark";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkAnchor } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActivityList, NoteForm } from "@/features/crm/components/activity-panel";
import { getContact, listCompanies, updateContactAction } from "@/features/companies/server/actions";
import { listActivities } from "@/features/tasks/server/actions";
import { RELATIONSHIP_STRENGTHS } from "@/lib/crm";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, companies] = await Promise.all([getContact(id), listCompanies()]);
  if (!contact) notFound();
  const activities = await listActivities({ contactId: id });

  return (
    <Stack gap="md">
      <PageHeader back={{ href: "/app/contacts", label: "Contacts" }} title={contact.display_name} subtitle={contact.companies?.name || contact.email} />
      <Grid>
        <GridCol span={{ base: 12, lg: 7 }}>
          <SectionPanel title="Overview">
            <ActionForm action={updateContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput name="first_name" label="First name" defaultValue={contact.first_name} />
                <TextInput name="last_name" label="Last name" defaultValue={contact.last_name} />
                <TextInput name="display_name" label="Display name" defaultValue={contact.display_name} style={{ gridColumn: "1 / -1" }} />
                <TextInput name="email" label="Email" defaultValue={contact.email} />
                <TextInput name="phone" label="Phone" defaultValue={contact.phone} />
                <TextInput name="job_title" label="Job title" defaultValue={contact.job_title} />
                <TextInput name="linkedin_url" label="LinkedIn" defaultValue={contact.linkedin_url} />
                <NativeSelect
                  name="company_id"
                  label="Company"
                  defaultValue={contact.company_id || ""}
                  data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
                />
                <NativeSelect
                  name="relationship_strength"
                  label="Relationship"
                  defaultValue={contact.relationship_strength}
                  data={RELATIONSHIP_STRENGTHS.map((item) => ({ value: item, label: item }))}
                />
              </SimpleGrid>
              <Textarea name="notes" label="Notes" defaultValue={contact.notes} />
            </ActionForm>
          </SectionPanel>
        </GridCol>
        <GridCol span={{ base: 12, lg: 5 }}>
          <SectionPanel title="Activity" fill>
            <NoteForm contactId={contact.id} companyId={contact.company_id || undefined} />
            <ActivityList items={activities} />
          </SectionPanel>
        </GridCol>
      </Grid>
      {contact.company_id ? (
        <Text size="sm">
          Company:{" "}
          <LinkAnchor href={`/app/companies/${contact.company_id}`} underline="never">
            <CompanyMark name={contact.companies?.name || "—"} logo={contact.companies?.logo_path} />
          </LinkAnchor>
        </Text>
      ) : null}
    </Stack>
  );
}
