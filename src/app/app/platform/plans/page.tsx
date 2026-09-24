import { Button, Checkbox, Group, NativeSelect, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadPlatformPlans, updatePlanAction } from "@/lib/platform/actions";
import { createPlatformInviteAction } from "@/lib/auth/actions";
import { requirePlatform } from "@/lib/auth/session";
import { VoidForm } from "@/components/platform/void-form";
import { loadPlatformStaff, removePlatformAdminAction, revokeInviteAction, setPlatformRoleAction } from "@/lib/platform/ops";
import { formatVnd } from "@/lib/money";

export default async function PlatformPlansPage() {
  const context = await requirePlatform();
  const plans = await loadPlatformPlans();
  const staff = context.platformRole === "super_admin" ? await loadPlatformStaff() : null;
  return (
    <Stack gap="md">
      <PageHeader title="Plans" subtitle="Configure the four public packages." />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {plans.map(({ plan, workspaceCount }) => (
          <SectionPanel key={plan.id} title={`Slot ${plan.slot} · ${plan.name}`}>
            <form
              action={async (formData) => {
                "use server";
                await updatePlanAction(formData);
              }}
            >
              <Stack gap="sm">
                <input type="hidden" name="id" value={plan.id} />
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput name="name" label="Name" defaultValue={plan.name} />
                  <TextInput name="badge" label="Badge" defaultValue={plan.badge} placeholder="Badge" />
                  <TextInput name="price_monthly" label="Monthly price" type="number" defaultValue={String(plan.priceMonthly)} />
                  <TextInput name="price_yearly" label="Yearly price" type="number" defaultValue={String(plan.priceYearly)} />
                  <TextInput name="trial_days" label="Trial days" type="number" defaultValue={String(plan.trialDays)} />
                  <TextInput name="seats" label="Seats" type="number" defaultValue={String(plan.quotas.seats)} />
                  <TextInput name="quotes_per_month" label="Quotes / month" type="number" defaultValue={String(plan.quotas.quotes_per_month)} />
                  <TextInput name="ai_briefs_per_month" label="AI briefs / month" type="number" defaultValue={String(plan.quotas.ai_briefs_per_month)} />
                  <TextInput name="maps_scrapes_per_month" label="Maps scrapes / month" type="number" defaultValue={String(plan.quotas.maps_scrapes_per_month)} />
                  <TextInput name="maps_places_per_month" label="Maps places / month" type="number" defaultValue={String(plan.quotas.maps_places_per_month)} />
                  <TextInput name="maps_people_per_month" label="Maps people / month" type="number" defaultValue={String(plan.quotas.maps_people_per_month)} />
                </SimpleGrid>
                <Group gap="md" mt={4}>
                  <Checkbox name="byok_ai" label="BYOK AI" defaultChecked={plan.features.byok_ai} />
                  <Checkbox name="lead_scrape" label="Lead scrape" defaultChecked={plan.features.lead_scrape} />
                  <Checkbox name="export_docx" label="Export docx" defaultChecked={plan.features.export_docx} />
                  <Checkbox name="custom_branding" label="Custom branding" defaultChecked={plan.features.custom_branding} />
                  <Checkbox name="contracts" label="Contracts" defaultChecked={plan.features.contracts} />
                </Group>
                <Group justify="space-between" align="flex-end" mt={4}>
                  <Stack gap={6}>
                    <Text size="sm" c="dimmed">
                      {plan.isFree ? "Free" : `${formatVnd(plan.priceMonthly)}/month`} · {workspaceCount} workspaces
                    </Text>
                    <Switch name="is_public" label="Listed on pricing" defaultChecked={plan.isPublic} />
                  </Stack>
                  <Button type="submit">Save plan</Button>
                </Group>
              </Stack>
            </form>
          </SectionPanel>
        ))}
      </SimpleGrid>
      {context.platformRole === "super_admin" ? (
      <SectionPanel title="Invite platform admin">
        <form
          action={async (formData) => {
            "use server";
            await createPlatformInviteAction(formData);
          }}
        >
          <Stack gap="sm">
            <TextInput name="email" type="email" required placeholder="Email" />
            <NativeSelect
              name="role"
              data={[
                { value: "support", label: "support" },
                { value: "super_admin", label: "super_admin" },
              ]}
            />
            <Button type="submit" w="fit-content">
              Create invite
            </Button>
          </Stack>
        </form>
      </SectionPanel>
      ) : null}
      {staff ? (
        <SectionPanel title="Platform staff">
          <Stack gap="sm">
            {staff.admins.map((admin) => (
              <Group key={admin.user_id} justify="space-between">
                <Text size="sm">
                  {admin.email} · {admin.role}
                </Text>
                <Group gap="xs">
                  <VoidForm action={setPlatformRoleAction}>
                    <input type="hidden" name="userId" value={admin.user_id} />
                    <input type="hidden" name="role" value={admin.role === "super_admin" ? "support" : "super_admin"} />
                    <Button type="submit" variant="subtle" size="compact-sm">
                      Make {admin.role === "super_admin" ? "support" : "super admin"}
                    </Button>
                  </VoidForm>
                  <VoidForm action={removePlatformAdminAction}>
                    <input type="hidden" name="userId" value={admin.user_id} />
                    <Button type="submit" variant="subtle" color="red" size="compact-sm">
                      Remove
                    </Button>
                  </VoidForm>
                </Group>
              </Group>
            ))}
            {staff.invites.map((invite) => (
              <Group key={invite.id} justify="space-between">
                <Text size="sm">
                  {invite.email} · {invite.role} · pending
                </Text>
                <VoidForm action={revokeInviteAction}>
                  <input type="hidden" name="id" value={invite.id} />
                  <input type="hidden" name="kind" value="platform" />
                  <Button type="submit" variant="subtle" color="red" size="compact-sm">
                    Revoke
                  </Button>
                </VoidForm>
              </Group>
            ))}
          </Stack>
        </SectionPanel>
      ) : null}
    </Stack>
  );
}
