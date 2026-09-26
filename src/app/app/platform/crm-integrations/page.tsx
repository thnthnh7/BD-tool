import { Alert, Badge, Button, Checkbox, Group, NativeSelect, Paper, PasswordInput, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadPlatformCrmIntegrations, updateCrmProviderConfigAction } from "@/features/crm-integrations/server/platform-actions";

export default async function PlatformCrmIntegrationsPage() {
  const data = await loadPlatformCrmIntegrations();
  const ready = data.providers.filter((provider) => provider.credentialsReady).length;
  const available = data.providers.filter((provider) => provider.config?.enabled).length;
  const activeConnections = data.providers.reduce((sum, provider) => sum + provider.usage.connected, 0);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  return (
    <Stack gap="md">
      <PageHeader title="CRM integrations" subtitle="Control connector rollout and verify platform credentials without exposing secrets." />
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Providers</Text><Text size="xl" fw={700}>{data.providers.length}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Credentials ready</Text><Text size="xl" fw={700}>{ready}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Available to users</Text><Text size="xl" fw={700}>{available}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Active connections</Text><Text size="xl" fw={700}>{activeConnections}</Text></Paper>
      </SimpleGrid>
      {!data.canMutate ? <Alert color="blue">Support accounts can inspect connector status. Only a super admin can change rollout settings.</Alert> : null}
      <SectionPanel title="Provider rollout">
        <Stack gap="sm">
          {data.providers.map((provider) => (
            <Paper key={provider.id} withBorder radius="md" p="md">
              <form action={updateCrmProviderConfigAction}>
                <input type="hidden" name="provider" value={provider.id} />
                <Group justify="space-between" align="flex-start" mb="sm">
                  <div>
                    <Group gap="xs"><Text fw={700}>{provider.name}</Text><Badge variant="light" color={provider.credentialsReady ? "teal" : "yellow"}>{provider.credentialsReady ? `Credentials ready · ${provider.credentialSource === "vault" ? "Vault" : provider.credentialSource === "environment" ? "Environment" : "Workspace"}` : "Credentials missing"}</Badge></Group>
                    <Text size="xs" c="dimmed">{provider.auth} · {provider.usage.connected} active / {provider.usage.total} configured workspaces</Text>
                    {provider.credentials.length ? <Text size="xs" c="dimmed">Redirect URL: {appUrl}/api/integrations/crm/{provider.id}/callback</Text> : null}
                  </div>
                  <Checkbox name="enabled" label="Available to users" defaultChecked={provider.config?.enabled || false} disabled={!data.canMutate || !provider.credentialsReady} />
                </Group>
                {provider.credentials.length === 0 ? <Text size="xs" c="dimmed" mb="sm">Credentials are supplied securely by each workspace.</Text> : (
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" mb="sm">
                    <PasswordInput name="client_id" label="Client ID" placeholder={provider.credentialsReady ? "Leave blank to keep current value" : "Enter client ID"} autoComplete="off" disabled={!data.canMutate} />
                    <PasswordInput name="client_secret" label="Client secret" placeholder={provider.credentialsReady ? "Leave blank to keep current value" : "Enter client secret"} autoComplete="new-password" disabled={!data.canMutate} />
                  </SimpleGrid>
                )}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <NativeSelect name="rollout_status" label="Rollout status" defaultValue={provider.config?.rollout_status || "not_configured"} disabled={!data.canMutate} data={[
                    { value: "not_configured", label: "Not configured" },
                    { value: "testing", label: "Internal testing" },
                    { value: "available", label: "Available" },
                    { value: "maintenance", label: "Maintenance" },
                  ]} />
                  <Textarea name="notes" label="Internal notes" defaultValue={provider.config?.notes || ""} placeholder="Registration, review or rollout notes" autosize minRows={1} maxRows={3} disabled={!data.canMutate} />
                </SimpleGrid>
                {data.canMutate ? <Group justify="flex-end" mt="sm"><Button type="submit" size="compact-sm">Save</Button></Group> : null}
              </form>
            </Paper>
          ))}
        </Stack>
      </SectionPanel>
    </Stack>
  );
}
