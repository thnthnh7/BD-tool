"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, CopyButton, Group, NativeSelect, Paper, Stack, Text, TextInput } from "@mantine/core";
import { Check, Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createMcpConnectionAction, revokeMcpConnectionAction, rotateMcpConnectionAction } from "@/features/mcp/server/actions";
import { mcpDefaultScopes, mcpScopeLabelKeys, mcpScopes } from "@/features/mcp/scopes";

type Connection = { id: string; name: string; token_prefix: string; scopes: string[]; status: string; display_status: string; last_used_at: string | null; expires_at: string | null; created_at: string };

export function McpConnectionManager({ connections, endpoint, enabled }: { connections: Connection[]; endpoint: string; enabled: boolean }) {
  const router = useRouter();
  const t = useTranslations("Mcp");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Stack gap="md" data-tutorial-id="mcp-connection-manager">
      {!enabled ? <Alert color="yellow">{t("paused")}</Alert> : null}
      {token ? (
        <Alert color="teal" title={t("tokenCreated")} icon={<KeyRound size={18} />}>
          <Stack gap="xs"><Text size="sm">{t("copyNow")}</Text><Group wrap="nowrap"><Text ff="monospace" size="sm" style={{ wordBreak: "break-all" }}>{token}</Text><CopyButton value={token}>{({ copied, copy }) => <Button size="compact-sm" variant="light" onClick={copy} leftSection={copied ? <Check size={14} /> : <Copy size={14} />}>{copied ? t("copied") : t("copy")}</Button>}</CopyButton></Group></Stack>
        </Alert>
      ) : null}
      <Paper withBorder radius="md" p="md" data-tutorial-id="mcp-token-form">
        <form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; setPending(true); setError(""); const result = await createMcpConnectionAction(new FormData(form)); setPending(false); if (result.error) return setError(result.error); setToken(result.token || ""); form.reset(); router.refresh(); }}>
          <Stack gap="sm">
            <TextInput name="name" label={t("connectionName")} placeholder={t("connectionPlaceholder")} required maxLength={80} />
            <NativeSelect name="expiry" label={t("tokenExpiry")} defaultValue="90" data={[{ value: "30", label: t("days30") }, { value: "90", label: t("days90") }]} />
            <div><Text size="sm" fw={500} mb={6}>{t("permissions")}</Text><Text size="xs" c="dimmed" mb={8}>Start with the minimum access this client needs. Write permissions are never selected automatically.</Text><Group>{mcpScopes.map((scope) => <Checkbox key={scope} name="scopes" value={scope} defaultChecked={mcpDefaultScopes.includes(scope)} label={t(mcpScopeLabelKeys[scope])} />)}</Group></div>
            {error ? <Text c="red" size="sm">{error}</Text> : null}
            <Button type="submit" loading={pending} disabled={!enabled} w="fit-content">{t("createToken")}</Button>
          </Stack>
        </form>
      </Paper>
      <Paper withBorder radius="md" p="md" data-tutorial-id="mcp-endpoint"><Text size="xs" c="dimmed">{t("endpoint")}</Text><Text ff="monospace" size="sm" mt={4}>{endpoint}</Text><Text size="xs" c="dimmed" mt={6}>{t("endpointHelp")}</Text></Paper>
      <Stack gap="xs" data-tutorial-id="mcp-connection-list">
        {connections.map((connection) => <Paper key={connection.id} withBorder radius="md" p="sm"><Group justify="space-between" align="center"><div><Group gap="xs"><Text fw={600} size="sm">{connection.name}</Text><Text size="xs" c={connection.display_status === "active" ? "teal" : connection.display_status === "expired" ? "orange" : "dimmed"}>{connection.display_status}</Text></Group><Text size="xs" c="dimmed">{connection.token_prefix} · {connection.scopes.join(", ")}</Text><Text size="xs" c="dimmed">{t("lastUsed", { value: connection.last_used_at ? new Date(connection.last_used_at).toLocaleString() : t("never") })} · {t("expires", { value: connection.expires_at ? new Date(connection.expires_at).toLocaleDateString() : t("never") })}</Text></div><Group gap="xs"><Button size="compact-sm" variant="subtle" onClick={async () => { const result = await rotateMcpConnectionAction(connection.id); if (result.error) return setError(result.error); setToken(result.token || ""); router.refresh(); }}>{t("rotate")}</Button>{connection.status === "active" ? <Button size="compact-sm" variant="subtle" color="red" onClick={async () => { await revokeMcpConnectionAction(connection.id); router.refresh(); }}>{t("revoke")}</Button> : null}</Group></Group></Paper>)}
        {!connections.length ? <Text size="sm" c="dimmed">{t("noConnections")}</Text> : null}
      </Stack>
    </Stack>
  );
}
