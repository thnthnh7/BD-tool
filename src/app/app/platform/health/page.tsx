import { Alert, Badge, Button, Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { requirePlatform } from "@/lib/auth/session";
import { VoidForm } from "@/components/platform/void-form";
import { loadPlatformHealth, runBillingNowAction, updatePlatformFlagsAction } from "@/lib/platform/ops";
import { setWorkspaceAgentByAdminAction } from "@/features/agent/server/settings";

export default async function PlatformHealthPage() {
  await requirePlatform("super_admin");
  const health = await loadPlatformHealth();
  return (
    <Stack gap="md">
      <PageHeader title="Health" subtitle="Kill switches, integration config, and the last time each job ran." />
      {health.alerts.length ? <Stack gap="xs">{health.alerts.map((alert) => <Alert key={alert.label} color={alert.severity === "critical" ? "red" : "orange"} title={alert.severity === "critical" ? "Action required" : "Review recommended"}>{alert.label}</Alert>)}</Stack> : <Alert color="teal" title="No operational alerts">Queues and scheduled billing checks are healthy.</Alert>}
      <SectionPanel title="Queue health">
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          {[
            ["CRM dead letters", health.queues.crmDeadLetters],
            ["Engagement failures", health.queues.engagementFailures],
            ["Billing webhooks stuck", health.queues.billingWebhooksStuck],
            ["Engagement webhook errors", health.queues.engagementWebhookErrors],
          ].map(([label, count]) => <div key={String(label)}><Text size="xs" c="dimmed">{label}</Text><Badge mt={4} color={Number(count) > 0 ? "red" : "teal"} variant="light">{count}</Badge></div>)}
        </SimpleGrid>
      </SectionPanel>
      <SectionPanel title="Switches">
        <VoidForm action={updatePlatformFlagsAction}>
          <Group>
            <Checkbox name="signup_enabled" label="Signup" defaultChecked={health.flags.signup_enabled} />
            <Checkbox name="ai_enabled" label="In-app assistant" defaultChecked={health.flags.ai_enabled} />
            <Checkbox name="scrape_enabled" label="Scrape" defaultChecked={health.flags.scrape_enabled} />
            <Checkbox name="share_enabled" label="Public share" defaultChecked={health.flags.share_enabled} />
          </Group>
          <Button type="submit" mt="sm">
            Save switches
          </Button>
        </VoidForm>
      </SectionPanel>
      <SectionPanel title="Workspace assistant">
        <Text size="sm" mb="sm">Turn the assistant or confirmed writes off for one workspace. The assistant switch above disables it everywhere.</Text>
        <VoidForm action={setWorkspaceAgentByAdminAction}>
          <TextInput name="workspace_id" label="Workspace ID" required mb="xs" />
          <Group>
            <Checkbox name="enabled" label="Assistant enabled" defaultChecked />
            <Checkbox name="write_enabled" label="Confirmed writes" />
          </Group>
          <Button type="submit" mt="sm">Save workspace assistant</Button>
        </VoidForm>
      </SectionPanel>
      <SectionPanel title="Configuration">
        <Text size="sm">Cron secret {health.config.cron ? "configured" : "missing"}</Text>
        <Text size="sm">SePay webhook secret {health.config.sepayWebhook ? "configured" : "missing"}</Text>
        <Text size="sm">Apify OAuth {health.config.apifyOauth ? "configured" : "missing"}</Text>
      </SectionPanel>
      <SectionPanel title="Last heartbeat">
        {health.heartbeats.map((beat, index) => (
          <Text key={beat?.kind || index} size="sm">
            {beat ? `${beat.kind} · ${beat.ok ? "ok" : "failed"} · ${beat.ran_at} · ${beat.detail}` : "No run recorded"}
          </Text>
        ))}
        <VoidForm action={runBillingNowAction}>
          <Button type="submit" mt="sm">
            Run billing
          </Button>
        </VoidForm>
      </SectionPanel>
    </Stack>
  );
}
