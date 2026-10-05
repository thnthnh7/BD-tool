import { Badge, Button, Checkbox, Group, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { PlanSettingsTabs } from "@/components/platform/plan-settings-tabs";
import { PlanConfigurationForm, PlanSaveButton } from "@/components/platform/plan-configuration-form";
import { createPlanAction, deletePlanAction, loadPlatformPlans } from "@/lib/platform/actions";
import { requirePlatform } from "@/lib/auth/session";
import classes from "@/styles/platform-plans.module.css";
import { billingProviderReady, getAllBillingProviderConfigs } from "@/lib/billing/config";
import { CAPABILITY_OPTIONS, MODULE_GROUPS } from "@/lib/module-catalog";

export default async function PlatformPlansPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const context = await requirePlatform();
  const [plans, providerConfigs] = await Promise.all([loadPlatformPlans(), getAllBillingProviderConfigs()]);
  const requestedPlan = (await searchParams).plan;
  const activePlan = plans.some(({ plan }) => plan.id === requestedPlan) ? requestedPlan! : plans[0]?.plan.id || "new";
  const stripeConnected = providerConfigs.some((config) => config.provider === "stripe" && billingProviderReady(config));
  const paypalConnected = providerConfigs.some((config) => config.provider === "paypal" && billingProviderReady(config));
  return (
    <Stack gap="md">
      <PageHeader title="Plan settings" subtitle="Create plans and manage their features, limits and pricing." />
      <PlanSettingsTabs
        activePlan={activePlan}
        plans={plans.map(({ plan }) => ({ id: plan.id, name: plan.name }))}
        newPlanPanel={context.platformRole === "super_admin" ? (
          <div className={classes.newPlanPanel}>
            <Text fw={700}>Create a new plan</Text>
            <Text size="sm" c="dimmed" mb="md">Start with safe defaults, then configure limits and pricing in its plan tab.</Text>
            <form action={async (formData) => {
              "use server";
              await createPlanAction(formData);
            }}>
              <Stack gap="sm">
                <TextInput name="name" label="Plan name" placeholder="Enterprise" required />
                <Checkbox name="is_free" label="This is a free plan" />
                <Group justify="flex-end">
                  <Button type="submit">Create plan</Button>
                </Group>
              </Stack>
            </form>
          </div>
        ) : undefined}
      >
        {plans.map(({ plan, workspaceCount, providerPrices }) => (
          <div className={classes.planPanel} key={plan.id}>
              <Group justify="space-between" align="flex-start" mb="md">
                <div>
                  <Text fw={700}>{plan.name}</Text>
                  <Text size="xs" c="dimmed">Slot {plan.slot} · {workspaceCount} workspaces</Text>
                </div>
                <Badge variant="light" color={plan.isPublic ? "leadely" : "gray"}>{plan.isPublic ? "Public" : "Hidden"}</Badge>
              </Group>
            <PlanConfigurationForm>
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="isFree" value={String(plan.isFree)} />
            <div className={classes.configSection}>
              <div className={classes.sectionHeading}>
                <Text size="sm" fw={700}>Plan details</Text>
                <Text size="xs" c="dimmed">Features, limits and availability.</Text>
              </div>
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput name="name" label="Name" defaultValue={plan.name} />
                  <TextInput name="badge" label="Badge" defaultValue={plan.badge} placeholder="Badge" />
                  <TextInput name="trial_days" label="Trial days" type="number" defaultValue={String(plan.trialDays)} />
                  <TextInput name="seats" label="Seats" type="number" defaultValue={String(plan.quotas.seats)} />
                  <TextInput name="quotes_per_month" label="Quotes / month" type="number" defaultValue={String(plan.quotas.quotes_per_month)} />
                  <TextInput name="ai_briefs_per_month" label="AI briefs / month" type="number" defaultValue={String(plan.quotas.ai_briefs_per_month)} />
                </SimpleGrid>
                <Text size="sm" fw={700} mt="xs">Modules included</Text>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                  {MODULE_GROUPS.map((group) => (
                    <Stack key={group.id} gap={6} p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10 }}>
                      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{group.label}</Text>
                      {group.modules.map(([key, label]) => (
                        <Checkbox key={key} name={`feature_${key}`} label={label} defaultChecked={plan.features[key]} />
                      ))}
                    </Stack>
                  ))}
                </SimpleGrid>
                <Text size="sm" fw={700} mt="xs">Advanced capabilities</Text>
                <Group gap="md">
                  {CAPABILITY_OPTIONS.map(([key, label]) => (
                    <Checkbox key={key} name={`feature_${key}`} label={label} defaultChecked={plan.features[key]} />
                  ))}
                </Group>
                <Switch name="is_public" label="Listed on pricing" defaultChecked={plan.isPublic} mt={4} />
                <Checkbox
                  name="apply_to_existing"
                  label="Apply entitlement changes to existing subscriptions"
                  description="Leave off to preserve the modules and quotas current customers subscribed to."
                />
              </Stack>
            </div>
            {!plan.isFree && context.platformRole === "super_admin" ? (
              <div className={classes.configSection}>
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={700}>Pricing</Text>
                      <Text size="xs" c="dimmed">Set the plan price in USD. Stripe and PayPal bill this amount. SePay converts it to VND at checkout.</Text>
                    </div>
                    <Group gap={6}>
                      <Badge size="sm" color={stripeConnected ? "leadely" : "gray"} variant="light">Stripe · {stripeConnected ? "Connected" : "Not connected"}</Badge>
                      <Badge size="sm" color={paypalConnected ? "leadely" : "gray"} variant="light">PayPal · {paypalConnected ? "Connected" : "Not connected"}</Badge>
                    </Group>
                  </Group>
                  <div className={classes.currencyGroup}>
                    <div className={classes.currencyLabel}>
                      <Text fw={700} size="sm">USD</Text>
                      <Text size="xs" c="dimmed">Monthly is required. Leave yearly blank until you offer it.</Text>
                    </div>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" className={classes.currencyFields}>
                    <TextInput
                      name="usd_monthly"
                      label="Monthly"
                      type="number"
                      min={0.01}
                      step={0.01}
                      defaultValue={String((providerPrices.find((item) => item.billing_interval === "monthly")?.amount || 0) / 100)}
                      leftSection="$"
                    />
                    <TextInput
                      name="usd_yearly"
                      label="Yearly"
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={String((providerPrices.find((item) => item.billing_interval === "yearly")?.amount || 0) / 100)}
                      leftSection="$"
                    />
                    </SimpleGrid>
                  </div>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {[stripeConnected ? "Stripe" : "", paypalConnected ? "PayPal" : ""].filter(Boolean).join(" and ") || "No provider"} will be synchronized when you save.
                    </Text>
                  </Group>
                </Stack>
              </div>
            ) : null}
            <Group justify="space-between" mt="md">
              <div>
                {context.platformRole === "super_admin" && !plan.isFree ? (
                  <Button
                    type="submit"
                    variant="light"
                    color="red"
                    disabled={workspaceCount > 0}
                    formAction={async (formData) => {
                      "use server";
                      await deletePlanAction(formData);
                    }}
                  >
                    Delete plan
                  </Button>
                ) : null}
              </div>
              <PlanSaveButton />
            </Group>
            </PlanConfigurationForm>
          </div>
        ))}
      </PlanSettingsTabs>
    </Stack>
  );
}
