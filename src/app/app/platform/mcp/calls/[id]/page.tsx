import { Badge, Button, Code, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadPlatformMcpCall } from "@/features/mcp/server/actions";
import { getTranslations } from "next-intl/server";

export default async function PlatformMcpCallPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("PlatformMcp");
  const { id } = await params;
  const data = await loadPlatformMcpCall(id);
  if (!data) notFound();
  const { call, workspace, connection } = data;
  return <Stack gap="md">
    <PageHeader title={call.tool_name} subtitle={t("callSubtitle")} action={<Button component="a" href="/app/platform/mcp" variant="light">{t("back")}</Button>} />
    <SectionPanel title={t("execution")}>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <div><Text size="xs" c="dimmed">{t("status")}</Text><Badge color={call.status === "success" ? "teal" : "red"} variant="light">{call.status}</Badge></div>
        <div><Text size="xs" c="dimmed">{t("duration")}</Text><Text fw={600}>{call.duration_ms} ms</Text></div>
        <div><Text size="xs" c="dimmed">{t("results")}</Text><Text fw={600}>{call.result_count ?? "—"}</Text></div>
        <div><Text size="xs" c="dimmed">{t("created")}</Text><Text fw={600}>{new Date(call.created_at).toLocaleString()}</Text></div>
      </SimpleGrid>
    </SectionPanel>
    <SectionPanel title={t("context")}><Stack gap="xs"><Group justify="space-between"><Text c="dimmed">{t("workspace")}</Text><Text>{workspace?.name || call.workspace_id}</Text></Group><Group justify="space-between"><Text c="dimmed">{t("connection")}</Text><Text>{connection?.name || "Unknown"}</Text></Group><Group justify="space-between"><Text c="dimmed">{t("connectionStatus")}</Text><Text>{connection?.status || "—"}</Text></Group><Group justify="space-between"><Text c="dimmed">{t("requestId")}</Text><Text ff="monospace">{call.request_id || "—"}</Text></Group><Group justify="space-between"><Text c="dimmed">{t("errorCode")}</Text><Text c={call.error_code ? "red" : undefined}>{call.error_code || "—"}</Text></Group></Stack></SectionPanel>
    <SectionPanel title={t("redactedInput")}><Code block>{JSON.stringify(call.input_summary, null, 2)}</Code><Text size="xs" c="dimmed" mt="xs">{t("redactedHelp")}</Text></SectionPanel>
  </Stack>;
}
