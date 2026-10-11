import { Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { LinkAnchor } from "@/components/mantine-link";
import { DashboardPanel } from "./dashboard-panel";

type Outcome = { label: string; value: number; detail: string; href: string; progress: number };

export function WorkflowOutcomesPanel({ outcomes, wonDeals, totalDeals, showData, showSequences }: {
  outcomes: { collected: number; ready: number; imported: number; enrolled: number; replied: number };
  wonDeals: number;
  totalDeals: number;
  showData: boolean;
  showSequences: boolean;
}) {
  const items: Outcome[] = [];
  if (showData) {
    items.push({ label: "Collected", value: outcomes.collected, detail: `${outcomes.ready} ready for review`, href: "/app/data", progress: ratio(outcomes.ready + outcomes.imported, outcomes.collected) });
    items.push({ label: "Imported to CRM", value: outcomes.imported, detail: `${ratio(outcomes.imported, outcomes.collected)}% of collected`, href: "/app/data?status=imported", progress: ratio(outcomes.imported, outcomes.collected) });
  }
  if (showSequences) {
    items.push({ label: "Sequence replies", value: outcomes.replied, detail: `${outcomes.enrolled} enrolled`, href: "/app/sequences", progress: ratio(outcomes.replied, outcomes.enrolled) });
  }
  items.push({ label: "Won deals", value: wonDeals, detail: `${totalDeals} total deals`, href: "/app/deals", progress: ratio(wonDeals, totalDeals) });
  return <DashboardPanel title="Workflow outcomes">
    <Stack gap="md">
      <Text size="xs" c="dimmed">Current workspace snapshot from collected data through sales outcomes.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: items.length }} spacing="lg">
        {items.map((item) => <Stack key={item.label} gap={6}>
          <Group justify="space-between" align="baseline"><LinkAnchor href={item.href} size="sm" fw={650} c="dark">{item.label}</LinkAnchor><Text fw={750} size="xl">{item.value}</Text></Group>
          <Progress value={item.progress} size="sm" radius="xl" />
          <Text size="xs" c="dimmed">{item.detail}</Text>
        </Stack>)}
      </SimpleGrid>
    </Stack>
  </DashboardPanel>;
}

function ratio(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
