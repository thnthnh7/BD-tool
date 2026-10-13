import Link from "next/link";
import { Alert, Badge, Button, Checkbox, Group, NumberInput, Select, SimpleGrid, Stack, Table, TableScrollContainer, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, TextInput, Textarea, Title } from "@mantine/core";
import { SectionPanel } from "@/components/leadely/section-panel";
import { PageHeader } from "@/components/leadely/page-header";
import { loadBetaProgram, manageBetaEnrollmentFormAction, updateBetaCampaignFormAction } from "@/lib/platform/beta";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function PlatformBetaPage() {
  const { campaign, enrollments } = await loadBetaProgram();
  if (!campaign) return <Alert color="red">Beta campaign is not configured.</Alert>;
  const counts = enrollments.reduce<Record<string, number>>((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  return <Stack gap="md">
    <PageHeader title="Beta Program" subtitle="Manage the first-member full-access campaign without creating payment subscriptions." />
    <SimpleGrid cols={{ base: 2, md: 5 }}>
      <SectionPanel title="Issued"><Title order={3}>{campaign.claimed_count}/{campaign.max_participants}</Title></SectionPanel>
      <SectionPanel title="Remaining"><Title order={3}>{Math.max(0, campaign.max_participants - campaign.claimed_count)}</Title></SectionPanel>
      <SectionPanel title="Active"><Title order={3}>{counts.active || 0}</Title></SectionPanel>
      <SectionPanel title="Converted"><Title order={3}>{counts.converted || 0}</Title></SectionPanel>
      <SectionPanel title="Expired / revoked"><Title order={3}>{(counts.expired || 0) + (counts.revoked || 0)}</Title></SectionPanel>
    </SimpleGrid>

    <SectionPanel title="Campaign configuration">
      <form action={updateBetaCampaignFormAction}>
        <input type="hidden" name="id" value={campaign.id} />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <TextInput name="name" label="Campaign name" defaultValue={campaign.name} required />
          <Select name="status" label="Status" defaultValue={campaign.status} data={["draft", "active", "paused", "ended"]} allowDeselect={false} />
          <NumberInput name="max_participants" label="Maximum participants" min={campaign.claimed_count || 1} defaultValue={campaign.max_participants} required />
          <NumberInput name="access_months" label="Full-access duration (months)" min={1} max={24} defaultValue={campaign.access_months} required />
          <TextInput name="starts_at" type="datetime-local" label="Starts at" defaultValue={localDateTime(campaign.starts_at)} required />
          <TextInput name="enrollment_ends_at" type="datetime-local" label="Enrollment closes (optional)" defaultValue={localDateTime(campaign.enrollment_ends_at)} />
          <TextInput name="headline" label="Signup headline" defaultValue={campaign.headline} required />
          <TextInput name="terms_url" label="Terms URL" defaultValue={campaign.terms_url} required />
        </SimpleGrid>
        <Textarea name="description" label="Signup and onboarding message" defaultValue={campaign.description} autosize minRows={2} mt="md" required />
        <Group mt="md">
          <Checkbox name="new_accounts_only" label="Only first-workspace accounts" defaultChecked={campaign.new_accounts_only} />
          <Checkbox name="require_verified_email" label="Require verified email" defaultChecked={campaign.require_verified_email} />
        </Group>
        <Group mt="lg" justify="space-between">
          <Text size="sm" c="dimmed">Plan modules and quotas are managed in <Link href={`/app/platform/plans?plan=${campaign.plan_id}`}>Plan details</Link>.</Text>
          <Button type="submit">Save Beta program</Button>
        </Group>
      </form>
    </SectionPanel>

    <SectionPanel title="Participants" padded={false}>
      <TableScrollContainer minWidth={1000}>
        <Table striped highlightOnHover>
          <TableThead><TableTr><TableTh>#</TableTh><TableTh>Member</TableTh><TableTh>Workspace</TableTh><TableTh>Status</TableTh><TableTh>Granted</TableTh><TableTh>Access ends</TableTh><TableTh>Actions</TableTh></TableTr></TableThead>
          <TableTbody>{enrollments.map((row) => <TableTr key={row.id}>
            <TableTd>{row.position}</TableTd>
            <TableTd><Text size="sm" fw={600}>{row.displayName || row.email}</Text><Text size="xs" c="dimmed">{row.email}</Text></TableTd>
            <TableTd>{row.workspaceName}</TableTd>
            <TableTd><Badge variant="light" color={row.status === "active" ? "teal" : row.status === "converted" ? "blue" : "gray"}>{row.status}</Badge></TableTd>
            <TableTd>{new Date(row.granted_at).toLocaleString()}</TableTd>
            <TableTd>{new Date(row.access_ends_at).toLocaleString()}</TableTd>
            <TableTd>{row.status === "active" ? <Group gap="xs" wrap="nowrap">
              <form action={manageBetaEnrollmentFormAction}><input type="hidden" name="enrollment_id" value={row.id} /><input type="hidden" name="mode" value="extend" /><input type="hidden" name="months" value="1" /><Button type="submit" size="compact-xs" variant="light">+1 month</Button></form>
              <form action={manageBetaEnrollmentFormAction}><input type="hidden" name="enrollment_id" value={row.id} /><input type="hidden" name="mode" value="revoke" /><Button type="submit" size="compact-xs" variant="subtle" color="red">Revoke</Button></form>
            </Group> : null}</TableTd>
          </TableTr>)}</TableTbody>
        </Table>
      </TableScrollContainer>
    </SectionPanel>
  </Stack>;
}
