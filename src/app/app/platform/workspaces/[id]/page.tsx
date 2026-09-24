import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Checkbox, Group, NativeSelect, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { requirePlatform } from "@/lib/auth/session";
import { loadPlatformPlans } from "@/lib/platform/actions";
import { VoidForm } from "@/components/platform/void-form";
import {
  archiveWorkspaceAction,
  loadWorkspaceDetail,
  platformMemberAction,
  purgeWorkspaceAction,
  revokeShareAction,
  saveWorkspaceNoteAction,
  saveWorkspaceOverrideAction,
  updateWorkspaceBillingAction,
} from "@/lib/platform/ops";

export default async function PlatformWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePlatform();
  const { id } = await params;
  const detail = await loadWorkspaceDetail(id);
  if (!detail) notFound();
  const plans = await loadPlatformPlans();
  const superAdmin = context.platformRole === "super_admin";
  const { workspace, subscription, plan, usage, notes, shares, counts, members, byok } = detail;
  const periodEnd = subscription?.current_period_end ? subscription.current_period_end.slice(0, 16) : "";

  return (
    <Stack gap="md">
      <PageHeader title={workspace.name} subtitle={`${workspace.type} · ${workspace.plan_status}${workspace.archived_at ? " · archived" : ""}`} />
      <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md">
        {[
          ["Companies", counts.companies || 0],
          ["Contacts", counts.contacts || 0],
          ["Leads", counts.leads || 0],
          ["Deals", counts.deals || 0],
          ["Quotes", counts.quotes || 0],
        ].map(([label, value]) => (
          <SectionPanel key={String(label)} title={String(label)}>
            <Text fw={700}>{value}</Text>
          </SectionPanel>
        ))}
      </SimpleGrid>
      <SectionPanel title="Plan and usage">
        <Text size="sm">Effective plan: {plan?.name || "Unknown"}</Text>
        <Text size="sm">Period ends: {subscription?.current_period_end || "—"} · {subscription?.billing_interval}</Text>
        <Text size="sm">
          Quotes {usage?.quotes_created || 0}/{plan?.quotas.quotes_per_month ?? "—"} · AI {usage?.ai_briefs || 0}/{plan?.quotas.ai_briefs_per_month ?? "—"} · Scrapes {usage?.maps_scrapes || 0}/{plan?.quotas.maps_scrapes_per_month ?? "—"}
        </Text>
        <Text size="sm">Members {members.length}/{plan?.quotas.seats ?? "—"}</Text>
      </SectionPanel>
      {superAdmin ? (
        <SectionPanel title="Change billing">
          <VoidForm action={updateWorkspaceBillingAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <NativeSelect name="planId" label="Plan" data={plans.map((item) => ({ value: item.plan.id, label: item.plan.name }))} defaultValue={workspace.plan_id} />
              <NativeSelect
                name="planStatus"
                label="Status"
                data={["trialing", "active", "past_due", "expired", "canceled"]}
                defaultValue={workspace.plan_status}
              />
              <TextInput name="periodEnd" label="Period end" type="datetime-local" defaultValue={periodEnd} />
              <NativeSelect name="interval" label="Interval" data={["monthly", "yearly"]} defaultValue={subscription?.billing_interval || "monthly"} />
            </SimpleGrid>
            <Button type="submit" mt="sm">
              Save billing
            </Button>
          </VoidForm>
        </SectionPanel>
      ) : null}
      {superAdmin ? (
        <SectionPanel title="Quota override">
          <VoidForm action={saveWorkspaceOverrideAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Text size="xs" c="dimmed" mb="sm">
              Leave a quota blank to keep the plan value. Checked feature boxes turn that feature on for this workspace.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput name="quotes_per_month" label="Quotes" placeholder="plan default" />
              <TextInput name="ai_briefs_per_month" label="AI briefs" />
              <TextInput name="maps_scrapes_per_month" label="Scrapes" />
              <TextInput name="maps_places_per_month" label="Places" />
              <TextInput name="maps_people_per_month" label="People" />
              <TextInput name="seats" label="Seats" />
            </SimpleGrid>
            <Group mt="sm">
              <Checkbox name="feature_byok_ai" label="BYOK" value="on" />
              <Checkbox name="feature_lead_scrape" label="Scrape" value="on" />
              <Checkbox name="feature_contracts" label="Contracts" value="on" />
              <Checkbox name="feature_export_docx" label="Docx" value="on" />
            </Group>
            <Button type="submit" mt="sm">
              Save override
            </Button>
          </VoidForm>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Members">
        <Stack gap="xs">
          {members.map((member) => (
            <Group key={member.user_id} justify="space-between">
              <Text size="sm">
                {member.email} · {member.role} · {member.status}
              </Text>
              {superAdmin ? (
                <Group gap="xs">
                  {member.role !== "owner" ? (
                    <>
                      <VoidForm action={platformMemberAction}>
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <input type="hidden" name="mode" value="role" />
                        <input type="hidden" name="role" value={member.role === "admin" ? "member" : "admin"} />
                        <Button type="submit" variant="subtle" size="compact-sm">
                          Make {member.role === "admin" ? "member" : "admin"}
                        </Button>
                      </VoidForm>
                      <VoidForm action={platformMemberAction}>
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <input type="hidden" name="mode" value="transfer" />
                        <Button type="submit" variant="subtle" size="compact-sm">
                          Make owner
                        </Button>
                      </VoidForm>
                      <VoidForm action={platformMemberAction}>
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <input type="hidden" name="mode" value="remove" />
                        <Button type="submit" variant="subtle" color="red" size="compact-sm">
                          Remove
                        </Button>
                      </VoidForm>
                    </>
                  ) : null}
                </Group>
              ) : null}
            </Group>
          ))}
        </Stack>
      </SectionPanel>
      <SectionPanel title="Internal notes">
        <VoidForm action={saveWorkspaceNoteAction}>
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <Textarea name="body" placeholder="Visible only to platform staff" />
          <Button type="submit" mt="sm">
            Add note
          </Button>
        </VoidForm>
        <Stack mt="md" gap="xs">
          {notes.map((note) => (
            <Text key={note.id} size="sm">
              {note.body}
            </Text>
          ))}
        </Stack>
      </SectionPanel>
      <SectionPanel title="BYOK">
        {byok.length === 0 ? <Text size="sm">No provider saved.</Text> : null}
        {byok.map((provider) => (
          <Text key={provider.provider} size="sm">
            {provider.provider} · {provider.model} · {provider.status} · key {provider.hasKey ? "saved" : "missing"}
            {provider.lastTestedAt ? ` · tested ${provider.lastTestedAt}` : ""}
          </Text>
        ))}
      </SectionPanel>
      <SectionPanel title="Public shares">
        {shares.map((share) => (
          <Group key={share.id} justify="space-between">
            <Text size="sm">{share.id}</Text>
            {superAdmin ? (
              <VoidForm action={revokeShareAction}>
                <input type="hidden" name="id" value={share.id} />
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <Button type="submit" variant="subtle" color="red" size="compact-sm">
                  Revoke
                </Button>
              </VoidForm>
            ) : null}
          </Group>
        ))}
      </SectionPanel>
      {superAdmin ? (
        <SectionPanel title="Archive and purge">
          <VoidForm action={archiveWorkspaceAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="restore" value={workspace.archived_at ? "true" : "false"} />
            <Button type="submit">{workspace.archived_at ? "Unarchive" : "Archive"}</Button>
          </VoidForm>
          <VoidForm action={purgeWorkspaceAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <TextInput name="confirm" label="Type the workspace name to purge" mt="sm" />
            <Button type="submit" color="red" mt="sm">
              Purge workspace
            </Button>
          </VoidForm>
          <Text size="xs" c="dimmed" mt="sm">
            <Link href={`/api/platform/workspaces/${workspace.id}/export`}>Download workspace JSON</Link>
          </Text>
        </SectionPanel>
      ) : null}
    </Stack>
  );
}
