import { Anchor, Avatar, Badge, Box, Divider, Group, Paper, Progress, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { ExternalLink, Gauge, MemoryStick } from "lucide-react";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { refreshApifyConnectionAction, saveApifyTokenAction, unlinkApifyConnectionAction } from "@/features/leads/server/apify-connection";

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

export function ApifyAccountStatus({ connection, canManage, oauthReady, compact = false, showSetup = false }: { connection: Connection | null; canManage: boolean; oauthReady: boolean; compact?: boolean; showSetup?: boolean }) {
  if (!connection) {
    return <Paper withBorder radius="lg" p="md"><Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Stack gap={2}>
          <Group gap="xs"><Badge color="gray" variant="light">Apify</Badge><Text fw={700}>Chưa kết nối tài khoản</Text></Group>
          <Text size="sm" c="dimmed">Workspace cần kết nối Apify riêng trước khi chạy Actor. Một tài khoản có thể dùng cho nhiều workspace.</Text>
        </Stack>
        {!showSetup && canManage && <LinkButton href="/app/settings">Thiết lập Apify</LinkButton>}
      </Group>
      {showSetup && canManage && <>
        <Divider />
        <Stack gap="xs">
          <Text fw={700} size="sm">Kết nối bằng API token</Text>
          <Text size="xs" c="dimmed">Tạo token riêng trong Apify Settings, giới hạn quyền phù hợp và dán vào đây một lần. Token được mã hóa và không hiển thị lại.</Text>
          <ActionForm action={saveApifyTokenAction} submitLabel="Kiểm tra và kết nối">
            <TextInput name="token_label" label="Tên token" defaultValue="Leadely" placeholder="Leadely" />
            <TextInput name="api_token" type="password" label="API token" placeholder="Dán Apify API token" autoComplete="new-password" required />
          </ActionForm>
        </Stack>
        <Divider label="hoặc" labelPosition="center" />
        <Group justify="space-between" wrap="wrap">
          <Box><Text fw={700} size="sm">Kết nối bằng OAuth</Text><Text size="xs" c="dimmed">Không cần quản lý token thủ công.</Text></Box>
          <LinkButton href="/api/integrations/apify/connect" disabled={!oauthReady}>Đăng nhập với Apify</LinkButton>
        </Group>
        {!oauthReady && <Text size="xs" c="orange.7">OAuth chưa được cấu hình; bạn vẫn có thể dùng API token ngay.</Text>}
      </>}
    </Stack></Paper>;
  }

  const memoryCurrent = Number(connection.current_memory_gbytes || 0);
  const memoryMax = Number(connection.max_memory_gbytes || 0);
  const usageCurrent = Number(connection.monthly_usage_usd || 0);
  const usageMax = Number(connection.max_monthly_usage_usd || 0);
  const usagePercent = usageMax > 0 ? Math.min(100, usageCurrent / usageMax * 100) : 0;
  const memoryPercent = memoryMax > 0 ? Math.min(100, memoryCurrent / memoryMax * 100) : 0;

  return <Paper withBorder radius="lg" p="md">
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
      <Group wrap="nowrap" gap="sm">
        <Avatar src={connection.apify_avatar_url || undefined} radius="xl" size={compact ? 38 : 46}>{connection.apify_username.slice(0, 1).toUpperCase()}</Avatar>
        <Stack gap={1}>
          <Group gap="xs"><Text fw={700}>{connection.apify_username}</Text><Badge size="sm" color={connection.status === "active" ? "teal" : "orange"} variant="light">{connection.status === "active" ? "Đã kết nối" : "Cần kết nối lại"}</Badge></Group>
          <Text size="xs" c="dimmed">{[connection.apify_email, connection.apify_plan_id, connection.auth_method === "api_token" ? `API token ••••${connection.token_last_four || ""}` : "OAuth"].filter(Boolean).join(" · ")}</Text>
          {!compact && <Text size="xs" c="dimmed">Usage và billing do tài khoản Apify này quản lý.</Text>}
        </Stack>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="lg" style={{ flex: "1 1 420px", maxWidth: 620 }}>
        <UsageMetric icon={<MemoryStick size={16} />} label="RAM" value={`${formatMemory(memoryCurrent)} / ${formatMemory(memoryMax)}`} percent={memoryPercent} color="blue" />
        <UsageMetric icon={<Gauge size={16} />} label="Usage" value={`${money(usageCurrent)} / ${money(usageMax)}`} percent={usagePercent} color={usagePercent >= 90 ? "red" : usagePercent >= 70 ? "orange" : "teal"} note={connection.usage_cycle_end ? `Reset ${new Date(connection.usage_cycle_end).toLocaleDateString("vi-VN")}` : undefined} />
      </SimpleGrid>
      {canManage && <Group gap="xs">
        <ActionForm action={refreshApifyConnectionAction} submitLabel="Cập nhật" variant="light" layout="inline"><input type="hidden" name="action" value="refresh" /></ActionForm>
        {oauthReady && <LinkButton href="/api/integrations/apify/connect" variant="default">Kết nối lại</LinkButton>}
        {!compact && <ActionForm action={unlinkApifyConnectionAction} submitLabel="Gỡ khỏi workspace" variant="light" layout="inline"><input type="hidden" name="action" value="unlink" /></ActionForm>}
        <Anchor href="https://console.apify.com/account#/integrations" target="_blank" size="sm">Apify <ExternalLink size={12} style={{ verticalAlign: "middle" }} /></Anchor>
      </Group>}
    </Group>
    {showSetup && canManage && <Box component="details" mt="md"><Text component="summary" size="sm" fw={600} style={{ cursor: "pointer" }}>{connection.auth_method === "api_token" ? "Thay API token" : "Chuyển sang API token"}</Text><Box pt="sm" maw={520}><ActionForm action={saveApifyTokenAction} submitLabel="Kiểm tra và cập nhật"><TextInput name="token_label" label="Tên token" defaultValue={connection.token_label || "Leadely"} /><TextInput name="api_token" type="password" label="API token mới" placeholder="Dán token mới" autoComplete="new-password" required /></ActionForm></Box></Box>}
    {connection.last_synced_at && <Text size="xs" c="dimmed" mt="xs">Cập nhật {new Date(connection.last_synced_at).toLocaleString("vi-VN")}</Text>}
  </Paper>;
}

function UsageMetric({ icon, label, value, percent, color, note }: { icon: React.ReactNode; label: string; value: string; percent: number; color: string; note?: string }) {
  return <Box><Group justify="space-between" gap="xs"><Group gap={6}>{icon}<Text size="xs" c="dimmed" fw={600}>{label}</Text></Group><Text size="sm" fw={700}>{value}</Text></Group><Progress value={percent} color={color} size="sm" mt={6} radius="xl" />{note && <Text size="xs" c="dimmed" mt={3}>{note}</Text>}</Box>;
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function formatMemory(gb: number) { return gb > 0 && gb < 1 ? `${Math.round(gb * 1024)} MB` : `${Number(gb.toFixed(2))} GB`; }
