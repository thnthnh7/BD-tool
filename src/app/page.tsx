import { Badge, Box, Card, Container, Group, List, ListItem, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { LinkButton } from "@/components/mantine-link";
import { createClient } from "@/lib/supabase/server";
import { parsePlan } from "@/lib/entitlements";
import { formatVnd } from "@/lib/money";
import classes from "@/styles/leadely-surfaces.module.css";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").eq("is_public", true).order("sort_order");
  const plans = (data || []).map(parsePlan);

  return (
    <main style={{ background: "var(--ld-canvas)", minHeight: "100vh" }}>
      <Container size="lg" py="lg">
        <Group justify="space-between" py="md">
          <AppLogo tagline />
          <Group gap="sm">
            <LinkButton href="/login" variant="subtle" color="gray">
              Sign in
            </LinkButton>
            <LinkButton href="/signup">Start free</LinkButton>
          </Group>
        </Group>

        <Stack gap="md" py={80} maw={720}>
          <Text size="sm" fw={600} c="leadely" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
            Your AI BD assistant
          </Text>
          <Title order={1} fw={700} style={{ fontSize: 40, lineHeight: 1.15 }}>
            More conversations. More opportunities.
          </Title>
          <Text c="dimmed" size="md" maw={560}>
            Create quotes, slideshows and contracts in one calm workspace. One account, one role.
          </Text>
          <LinkButton href="/signup" w="fit-content">
            Start free
          </LinkButton>
        </Stack>

        <SimpleGrid id="pricing" cols={{ base: 1, sm: 2, md: 4 }} spacing="md" pb={80}>
          {plans.map((plan) => (
            <Card key={plan.id} withBorder padding="lg" className={classes.panel} style={{ display: "flex", flexDirection: "column" }}>
              <Group justify="space-between" wrap="nowrap" gap="xs" mih={24}>
                <Text size="xs" fw={600} c="dimmed">
                  {plan.isFree ? "Free forever" : "Subscription"}
                </Text>
                {plan.badge ? (
                  <Badge color="leadely" variant="light">
                    {plan.badge}
                  </Badge>
                ) : null}
              </Group>
              <Title order={3} mt="xs">
                {plan.name}
              </Title>
              <Text fw={700} size="xl" mt="xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                {plan.isFree ? `0 ${"\u20AB"}/mo` : `${formatVnd(plan.priceMonthly)}/mo`}
              </Text>
              <List mt="md" size="sm" c="dimmed" spacing={4}>
                <ListItem>{plan.quotas.seats < 0 ? "Unlimited" : plan.quotas.seats} seats</ListItem>
                <ListItem>
                  {plan.quotas.quotes_per_month < 0 ? "Unlimited" : plan.quotas.quotes_per_month} quotes/month
                </ListItem>
                <ListItem>
                  {plan.quotas.ai_briefs_per_month < 0 ? "Unlimited" : plan.quotas.ai_briefs_per_month} AI briefs/month
                </ListItem>
              </List>
              <Box style={{ marginTop: "auto", paddingTop: 24 }}>
                <LinkButton href="/signup" fullWidth variant={plan.badge ? "filled" : "default"}>
                  {plan.isFree ? "Start free" : `Choose ${plan.name}`}
                </LinkButton>
              </Box>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </main>
  );
}
