import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { LinkButton } from "@/components/mantine-link";
import { disconnectEngagementAccountAction, syncEngagementAccountsAction } from "@/features/comms/server/account-actions";
import { engagementProviderReady } from "@/features/comms/server/providers";

type Account = {
  id: string;
  provider: string;
  account_email: string;
  display_name: string;
  status: string;
  authorized_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

export function EngagementAccountsPanel({ accounts, oauthStatus }: { accounts: Account[]; oauthStatus?: string }) {
  return (
    <Stack gap="sm">
      {oauthStatus ? (
        <Text size="sm" c={oauthStatus === "connected" ? "teal" : "red"}>
          {oauthStatus === "connected" ? "Mailbox and calendar account connected." : `Connection was not completed (${oauthStatus}).`}
        </Text>
      ) : null}
      <Group gap="sm">
        <LinkButton href="/api/integrations/engage/google/connect" variant="default" disabled={!engagementProviderReady("google")}>
          Connect Google
        </LinkButton>
        <LinkButton href="/api/integrations/engage/microsoft/connect" variant="default" disabled={!engagementProviderReady("microsoft")}>
          Connect Microsoft
        </LinkButton>
        {accounts.some((account) => account.status === "connected") ? (
          <ActionForm action={syncEngagementAccountsAction} submitLabel="Sync now" variant="light"><></></ActionForm>
        ) : null}
      </Group>
      {!engagementProviderReady("google") || !engagementProviderReady("microsoft") ? (
        <Text size="xs" c="dimmed">Providers become available automatically when their OAuth credentials are configured.</Text>
      ) : null}
      {accounts.map((account) => (
        <Paper key={account.id} withBorder radius="md" p="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Group gap="xs">
                <Text fw={650} size="sm">{account.display_name || account.account_email}</Text>
                <Badge color={account.status === "connected" ? "teal" : "red"} variant="light">{account.status}</Badge>
              </Group>
              <Text size="xs" c="dimmed">{account.provider} · {account.account_email}</Text>
              <Text size="xs" c="dimmed">
                {account.last_synced_at ? `Last synced ${new Date(account.last_synced_at).toLocaleString()}` : "Waiting for first sync"}
              </Text>
              {account.last_error ? <Text size="xs" c="red" mt={4}>{account.last_error}</Text> : null}
            </div>
            <ActionForm action={disconnectEngagementAccountAction} submitLabel="Disconnect" variant="light">
              <input type="hidden" name="account_id" value={account.id} />
            </ActionForm>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
