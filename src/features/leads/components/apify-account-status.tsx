import { Avatar, Badge, Box, Divider, Group, Paper, Progress, Stack, Text, TextInput } from "@mantine/core";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { saveApifyTokenAction } from "@/features/leads/server/apify-actions";
import { ApifyRefreshButton, ApifyUnlinkButton } from "./apify-refresh-button";
import classes from "./apify-account-status.module.css";
import { useLocale, useTranslations } from "next-intl";

type Connection = {
  apify_username: string;
  apify_email: string;
  apify_avatar_url: string | null;
  apify_plan_id: string | null;
  status: string;
  current_memory_gbytes: number | null;
  max_memory_gbytes: number | null;
  monthly_usage_usd: number | null;
  max_monthly_usage_usd: number | null;
  usage_cycle_end: string | null;
  last_synced_at: string | null;
  auth_method: string;
  token_last_four: string | null;
  token_label: string | null;
};

export function ApifyAccountStatus({ connection, canManage, oauthReady, compact = false, showSetup = false, activitySummary = [] }: { connection: Connection | null; canManage: boolean; oauthReady: boolean; compact?: boolean; showSetup?: boolean; activitySummary?: string[] }) {
  const t = useTranslations("Apify");
  const locale = useLocale();
  if (!connection) {
    return <Paper withBorder radius="lg" p="md"><Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Stack gap={2}>
          <Group gap="xs"><Badge color="gray" variant="light">Apify</Badge><Text fw={700}>{t("notConnected")}</Text></Group>
          <Text size="sm" c="dimmed">{t("connectionHelp")}</Text>
        </Stack>
        {!showSetup && canManage && <LinkButton href="/app/settings">{t("setup")}</LinkButton>}
      </Group>
      {showSetup && canManage && <>
        <Divider />
        <Stack gap="xs">
          <Text fw={700} size="sm">{t("tokenConnect")}</Text>
          <Text size="xs" c="dimmed">{t("tokenHelp")}</Text>
          <ActionForm action={saveApifyTokenAction} submitLabel={t("connect")}>
            <TextInput name="token_label" label={t("tokenName")} defaultValue="Leadely" placeholder="Leadely" />
            <TextInput name="api_token" type="password" label="API token" placeholder={t("tokenPlaceholder")} autoComplete="new-password" required />
          </ActionForm>
        </Stack>
        <Divider label={t("or")} labelPosition="center" />
        <Group justify="space-between" wrap="wrap">
          <Box><Text fw={700} size="sm">{t("oauthConnect")}</Text><Text size="xs" c="dimmed">{t("oauthHelp")}</Text></Box>
          <LinkButton href="/api/integrations/apify/connect" disabled={!oauthReady}>{t("signIn")}</LinkButton>
        </Group>
        {!oauthReady && <Text size="xs" c="orange.7">{t("oauthUnavailable")}</Text>}
      </>}
    </Stack></Paper>;
  }

  const memoryCurrent = Number(connection.current_memory_gbytes || 0);
  const memoryMax = Number(connection.max_memory_gbytes || 0);
  const usageCurrent = Number(connection.monthly_usage_usd || 0);
  const usageMax = Number(connection.max_monthly_usage_usd || 0);
  const usagePercent = usageMax > 0 ? Math.min(100, usageCurrent / usageMax * 100) : 0;
  const memoryPercent = memoryMax > 0 ? Math.min(100, memoryCurrent / memoryMax * 100) : 0;

  if (compact) {
    const accountMeta = [connection.apify_plan_id, connection.auth_method === "api_token" ? `Token ••••${connection.token_last_four || ""}` : "OAuth"].filter(Boolean).join(" · ");
    return <Paper withBorder radius="lg" p="sm" className={classes.compactCard}>
      <Box className={classes.compactLayout}>
        <Group wrap="nowrap" gap="sm" className={classes.account}>
          <Avatar src={connection.apify_avatar_url || undefined} radius="xl" size={34}>{connection.apify_username.slice(0, 1).toUpperCase()}</Avatar>
          <Stack gap={1} className={classes.accountText}>
            <Group gap={6} wrap="nowrap"><Text fw={700} size="sm" truncate>{connection.apify_username}</Text><Box className={connection.status === "active" ? classes.statusDot : classes.statusWarning} title={connection.status === "active" ? t("connected") : t("reconnectRequired")} /></Group>
            <Text size="xs" c="dimmed" truncate>{accountMeta}</Text>
          </Stack>
        </Group>
        <Box className={classes.metrics}>
          <CompactMetric label="RAM" value={`${formatMemory(memoryCurrent)} / ${formatMemory(memoryMax)}`} percent={memoryPercent} color="blue" />
          <CompactMetric label="Usage" value={`${money(usageCurrent)} / ${money(usageMax)}`} percent={usagePercent} color={usagePercent >= 90 ? "red" : usagePercent >= 70 ? "orange" : "teal"} />
        </Box>
      </Box>
      <Group justify="space-between" gap="xs" mt={6} className={classes.metaRow}>
        <Group gap={6} wrap="wrap">
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed">{connection.last_synced_at ? t("synced", { date: new Date(connection.last_synced_at).toLocaleString(locale) }) : t("neverSynced")}</Text>
            {canManage && <ApifyRefreshButton />}
          </Group>
          {activitySummary.length > 0 && <Text size="xs" c="dimmed">·</Text>}
          {activitySummary.map((item, index) => <Text key={`${item}-${index}`} size="xs" fw={600}>{item}</Text>)}
        </Group>
        {connection.usage_cycle_end && <Text size="xs" c="dimmed">{t("reset", { date: new Date(connection.usage_cycle_end).toLocaleDateString(locale) })}</Text>}
      </Group>
    </Paper>;
  }

  return <Paper withBorder radius="lg" p="md">
    <Box className={classes.settingsSummary}>
      <Group wrap="nowrap" gap="sm" className={classes.account}>
        <Avatar src={connection.apify_avatar_url || undefined} radius="xl" size={40}>{connection.apify_username.slice(0, 1).toUpperCase()}</Avatar>
        <Stack gap={1} className={classes.accountText}>
          <Group gap={6} wrap="nowrap"><Text fw={700} size="sm" truncate>{connection.apify_username}</Text><Box className={connection.status === "active" ? classes.statusDot : classes.statusWarning} title={connection.status === "active" ? t("connected") : t("reconnectRequired")} /></Group>
          <Text size="xs" c="dimmed" truncate>{[connection.apify_email, connection.apify_plan_id, connection.auth_method === "api_token" ? `Token ••••${connection.token_last_four || ""}` : "OAuth"].filter(Boolean).join(" · ")}</Text>
        </Stack>
      </Group>
      <Box className={classes.metrics}>
        <CompactMetric label="RAM" value={`${formatMemory(memoryCurrent)} / ${formatMemory(memoryMax)}`} percent={memoryPercent} color="blue" />
        <CompactMetric label="Usage" value={`${money(usageCurrent)} / ${money(usageMax)}`} percent={usagePercent} color={usagePercent >= 90 ? "red" : usagePercent >= 70 ? "orange" : "teal"} />
      </Box>
    </Box>
    <Group justify="space-between" gap="xs" mt="xs" className={classes.settingsMeta}>
      <Group gap={4} wrap="nowrap"><Text size="xs" c="dimmed">{connection.last_synced_at ? t("synced", { date: new Date(connection.last_synced_at).toLocaleString(locale) }) : t("neverSynced")}</Text>{canManage && <ApifyRefreshButton />}</Group>
      {connection.usage_cycle_end && <Text size="xs" c="dimmed">{t("reset", { date: new Date(connection.usage_cycle_end).toLocaleDateString(locale) })}</Text>}
    </Group>
    {showSetup && canManage && <>
      <Divider my="sm" />
      <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
        <Box component="details" className={classes.tokenDetails}><Text component="summary" size="sm" fw={600} style={{ cursor: "pointer" }}>{connection.auth_method === "api_token" ? t("replaceToken") : t("switchToken")}</Text><Box pt="sm" maw={520}><ActionForm action={saveApifyTokenAction} submitLabel={t("updateToken")}><TextInput name="token_label" label={t("tokenName")} defaultValue={connection.token_label || "Leadely"} /><TextInput name="api_token" type="password" label={t("newToken")} placeholder={t("newTokenPlaceholder")} autoComplete="new-password" required /></ActionForm></Box></Box>
        <Group gap={4}>
          {oauthReady && <LinkButton href="/api/integrations/apify/connect" variant="subtle" size="compact-sm">{t("reconnect")}</LinkButton>}
          <ApifyUnlinkButton />
        </Group>
      </Group>
    </>}
  </Paper>;
}
function CompactMetric({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return <Box className={classes.metric}><Group justify="space-between" gap="sm" wrap="nowrap"><Text size="xs" c="dimmed">{label}</Text><Text size="xs" fw={700}>{value}</Text></Group><Progress value={percent} color={color} size={4} mt={4} radius="xl" /></Box>;
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function formatMemory(gb: number) { return gb > 0 && gb < 1 ? `${Math.round(gb * 1024)} MB` : `${Number(gb.toFixed(2))} GB`; }
