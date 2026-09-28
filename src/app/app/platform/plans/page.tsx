import { Badge, Button, Checkbox, Group, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { PlanSettingsTabs } from "@/components/platform/plan-settings-tabs";
import { createPlanAction, deletePlanAction, loadPlatformPlans, updatePlanConfigurationAction } from "@/lib/platform/actions";
import { requirePlatform } from "@/lib/auth/session";
import classes from "@/styles/platform-plans.module.css";

export default async function PlatformPlansPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const context = await requirePlatform();
  const plans = await loadPlatformPlans();
  const requestedPlan = (await searchParams).plan;
  const activePlan = plans.some(({ plan }) => plan.id === requestedPlan) ? requestedPlan! : plans[0]?.plan.id || "new";
  const stripeConnected = Boolean(process.env.STRIPE_SECRET_KEY);
  const paypalConnected = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
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
            <form
              action={async (formData) => {
                "use server";
                await updatePlanConfigurationAction(formData);
              }}
            >
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
                  <Checkbox name="mcp_access" label="MCP access" defaultChecked={plan.features.mcp_access} />
                </Group>
                <Switch name="is_public" label="Listed on pricing" defaultChecked={plan.isPublic} mt={4} />
              </Stack>
            </div>
            {!plan.isFree && context.platformRole === "super_admin" ? (
              <div className={classes.configSection}>
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={700}>Pricing</Text>
                      <Text size="xs" c="dimmed">VND is used by SePay; USD is synchronized to connected providers.</Text>
                    </div>
                    <Group gap={6}>
                      <Badge size="sm" color={stripeConnected ? "leadely" : "gray"} variant="light">Stripe · {stripeConnected ? "Connected" : "Not connected"}</Badge>
                      <Badge size="sm" color={paypalConnected ? "leadely" : "gray"} variant="light">PayPal · {paypalConnected ? "Connected" : "Not connected"}</Badge>
                    </Group>
                  </Group>
                  <div className={classes.currencyGroup}>
                    <div className={classes.currencyLabel}>
                      <Text fw={700} size="sm">VND</Text>
                      <Text size="xs" c="dimmed">SePay and local bank transfer</Text>
                    </div>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" className={classes.currencyFields}>
                      <TextInput name="vnd_monthly" label="Monthly" type="number" min={1} step={1000} defaultValue={String(plan.priceMonthly)} rightSection="₫" />
                      <TextInput name="vnd_yearly" label="Yearly" type="number" min={1} step={1000} defaultValue={String(plan.priceYearly)} rightSection="₫" />
                    </SimpleGrid>
                  </div>
                  <div className={classes.currencyGroup}>
                    <div className={classes.currencyLabel}>
                      <Text fw={700} size="sm">USD</Text>
                      <Text size="xs" c="dimmed">Stripe and PayPal subscriptions</Text>
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
                      min={0.01}
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
              <Button type="submit">Save plan</Button>
            </Group>
            </form>
          </div>
        ))}
      </PlanSettingsTabs>
    </Stack>
  );
}
