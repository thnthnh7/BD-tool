import { Badge, Button, Code, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadPlatformMcpCall } from "@/features/mcp/server/actions";

export default async function PlatformMcpCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPlatformMcpCall(id);
  if (!data) notFound();
  const { call, workspace, connection } = data;
  return <Stack gap="md">
    <PageHeader title={call.tool_name} subtitle="Redacted MCP tool-call detail for operational investigation." action={<Button component="a" href="/app/platform/mcp" variant="light">Back to MCP</Button>} />
    <SectionPanel title="Execution">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <div><Text size="xs" c="dimmed">Status</Text><Badge color={call.status === "success" ? "teal" : "red"} variant="light">{call.status}</Badge></div>
        <div><Text size="xs" c="dimmed">Duration</Text><Text fw={600}>{call.duration_ms} ms</Text></div>
        <div><Text size="xs" c="dimmed">Results</Text><Text fw={600}>{call.result_count ?? "—"}</Text></div>
        <div><Text size="xs" c="dimmed">Created</Text><Text fw={600}>{new Date(call.created_at).toLocaleString()}</Text></div>
      </SimpleGrid>
    </SectionPanel>
    <SectionPanel title="Context"><Stack gap="xs"><Group justify="space-between"><Text c="dimmed">Workspace</Text><Text>{workspace?.name || call.workspace_id}</Text></Group><Group justify="space-between"><Text c="dimmed">Connection</Text><Text>{connection?.name || "Unknown"}</Text></Group><Group justify="space-between"><Text c="dimmed">Connection status</Text><Text>{connection?.status || "—"}</Text></Group><Group justify="space-between"><Text c="dimmed">Request ID</Text><Text ff="monospace">{call.request_id || "—"}</Text></Group><Group justify="space-between"><Text c="dimmed">Error code</Text><Text c={call.error_code ? "red" : undefined}>{call.error_code || "—"}</Text></Group></Stack></SectionPanel>
    <SectionPanel title="Redacted input summary"><Code block>{JSON.stringify(call.input_summary, null, 2)}</Code><Text size="xs" c="dimmed" mt="xs">Sensitive values are removed before this audit record is stored.</Text></SectionPanel>
  </Stack>;
}
