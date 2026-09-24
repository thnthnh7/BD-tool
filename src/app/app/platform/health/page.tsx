import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { requirePlatform } from "@/lib/auth/session";
import { VoidForm } from "@/components/platform/void-form";
import { loadPlatformHealth, runBillingNowAction, updatePlatformFlagsAction } from "@/lib/platform/ops";

export default async function PlatformHealthPage() {
  await requirePlatform("super_admin");
  const health = await loadPlatformHealth();
  return (
    <Stack gap="md">
      <PageHeader title="Health" subtitle="Kill switches, integration config, and the last time each job ran." />
      <SectionPanel title="Switches">
        <VoidForm action={updatePlatformFlagsAction}>
          <Group>
            <Checkbox name="signup_enabled" label="Signup" defaultChecked={health.flags.signup_enabled} />
            <Checkbox name="ai_enabled" label="Platform AI" defaultChecked={health.flags.ai_enabled} />
            <Checkbox name="scrape_enabled" label="Scrape" defaultChecked={health.flags.scrape_enabled} />
            <Checkbox name="share_enabled" label="Public share" defaultChecked={health.flags.share_enabled} />
          </Group>
          <Button type="submit" mt="sm">
            Save switches
          </Button>
        </VoidForm>
      </SectionPanel>
      <SectionPanel title="Configuration">
        <Text size="sm">Cron secret {health.config.cron ? "configured" : "missing"}</Text>
        <Text size="sm">SePay webhook secret {health.config.sepayWebhook ? "configured" : "missing"}</Text>
        <Text size="sm">Apify OAuth {health.config.apifyOauth ? "configured" : "missing"}</Text>
        <Text size="sm">Platform AI {health.config.platformAi ? "configured" : "missing"}</Text>
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
