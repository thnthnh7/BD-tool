import { requireModule } from "@/lib/auth/session";
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { McpConnectionManager } from "@/features/mcp/components/connection-manager";
import { McpClientSetupGuide } from "@/features/mcp/components/client-setup-guide";
import { loadMcpWorkspace, reviewMcpActionRequestAction } from "@/features/mcp/server/actions";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

function requestPayload(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function McpPage({ searchParams }: { searchParams: Promise<{ request?: string; status?: string }> }) {
  await requireModule("mcp_access");
  const params = await searchParams;
  const selectedRequest = params.request;
  const statusFilter = ["pending", "completed", "rejected", "failed", "expired"].includes(params.status || "") ? params.status : "all";
  const data = await loadMcpWorkspace();
  const t = await getTranslations("Mcp");
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const endpoint = `${baseUrl}/api/mcp`;
  const connectionNames = Object.fromEntries(data.connections.map((connection) => [connection.id, connection.name]));
  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <SectionPanel title={t("connections")}><McpConnectionManager connections={data.connections} endpoint={endpoint} enabled={Boolean(data.settings?.enabled && data.settings.read_tools_enabled)} /></SectionPanel>
    <SectionPanel title={t("connectClient")}><McpClientSetupGuide endpoint={endpoint} writeEnabled={Boolean(data.settings?.write_tools_enabled)} /></SectionPanel>
    <SectionPanel title={t("approvalQueue")}>
      <Group gap="xs" mb="xs">{["all", "pending", "completed", "rejected", "failed", "expired"].map((status) => <Link key={status} href={status === "all" ? "/app/mcp" : `/app/mcp?status=${status}`} style={{ textDecoration: "none" }}><Button size="compact-xs" variant={statusFilter === status ? "light" : "subtle"}>{status}</Button></Link>)}</Group>
      <Stack gap="xs">{data.actionRequests.filter((request) => statusFilter === "all" || request.status === statusFilter).map((request) => {
        const payload = requestPayload(request.payload);
        const requestTitle = request.action_type === "create_company" ? t("createCompanyRequest") : request.action_type === "mark_quote_sent" ? t("markQuoteSentRequest") : request.action_type === "start_crm_sync" ? "Start CRM synchronization" : t("startScrapeRequest");
        const summary = request.action_type === "start_maps_scrape"
          ? [payload.query, payload.location].filter(Boolean).join(" · ")
          : String(payload.name || payload.title || "");
        return <Paper id={`request-${request.id}`} key={request.id} withBorder p="sm" radius="md" bg={selectedRequest === request.id ? "teal.0" : undefined}><Group justify="space-between" align="flex-start"><div><Group gap="xs"><Text fw={600} size="sm">{requestTitle}</Text><Badge variant="light" color={request.status === "pending" ? "orange" : request.status === "completed" ? "teal" : request.status === "failed" ? "red" : "gray"}>{request.status}</Badge></Group>{summary ? <Text size="sm" mt={4}>{summary}</Text> : null}<Text size="xs" c="dimmed">{connectionNames[request.connection_id || ""] || "MCP"}{payload.maxResults ? ` · ${payload.maxResults} ${t("results").toLocaleLowerCase()}` : ""}</Text>{request.status === "pending" ? <Text size="xs" c="dimmed">{t("approvalExpires", { value: new Date(request.expires_at).toLocaleString() })}</Text> : null}{request.error_message ? <Text size="xs" c="red">{request.error_message}</Text> : null}</div>{request.status === "pending" ? <Group gap="xs"><form action={reviewMcpActionRequestAction}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="decision" value="approve" /><Button type="submit" size="compact-sm">{t("approveRequest")}</Button></form><form action={reviewMcpActionRequestAction}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="decision" value="reject" /><Button type="submit" size="compact-sm" variant="subtle" color="red">{t("rejectRequest")}</Button></form></Group> : null}</Group></Paper>;
      })}{!data.actionRequests.some((request) => statusFilter === "all" || request.status === statusFilter) ? <Text size="sm" c="dimmed">{t("noActionRequests")}</Text> : null}</Stack>
    </SectionPanel>
    <SectionPanel title={t("recentCalls")} padded={false}><Table><TableThead><TableTr><TableTh>{t("when")}</TableTh><TableTh>{t("tool")}</TableTh><TableTh>{t("status")}</TableTh><TableTh>{t("results")}</TableTh><TableTh>{t("duration")}</TableTh></TableTr></TableThead><TableTbody>{data.calls.map((call) => <TableTr key={call.id}><TableTd>{new Date(call.created_at).toLocaleString()}</TableTd><TableTd>{call.tool_name}</TableTd><TableTd>{call.status}</TableTd><TableTd>{call.result_count ?? "—"}</TableTd><TableTd>{call.duration_ms} ms</TableTd></TableTr>)}</TableTbody></Table></SectionPanel>
  </Stack>;
}
