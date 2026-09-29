import { Alert, Badge, Button, Checkbox, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { loadPlatformMcp, revokePlatformMcpConnectionAction, setMcpOAuthClientStatusAction, updateMcpSettingsAction } from "@/features/mcp/server/actions";

type SearchParams = Promise<{ q?: string; status?: string; tool?: string; callPage?: string }>;

export default async function PlatformMcpPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const query = String(filters.q || "").trim().toLocaleLowerCase();
  const status = String(filters.status || "all");
  const tool = String(filters.tool || "all");
  const requestedPage = Math.max(1, Number.parseInt(String(filters.callPage || "1"), 10) || 1);
  const data = await loadPlatformMcp({ callPage: requestedPage, status, tool: tool === "all" ? undefined : tool });
  const active = data.connections.filter((item) => item.status === "active").length;
  const errorRate = data.metrics.calls > 0 ? data.metrics.errors / data.metrics.calls : 0;
  const healthIssues = [
    data.metrics.calls >= 10 && errorRate >= 0.1 ? `${Math.round(errorRate * 100)}% of calls failed in the last 24 hours` : null,
    data.metrics.calls > 0 && data.metrics.p95 >= 2_000 ? `P95 latency is ${data.metrics.p95} ms` : null,
    data.metrics.failedApprovals > 0 ? `${data.metrics.failedApprovals} approved action${data.metrics.failedApprovals === 1 ? "" : "s"} failed` : null,
  ].filter((issue): issue is string => Boolean(issue));
  const connectionNames = Object.fromEntries(data.connections.map((connection) => [connection.id, connection.name]));
  const latestOAuthToken = new Map<string, (typeof data.oauthTokens)[number]>();
  for (const tokenRecord of data.oauthTokens) if (!latestOAuthToken.has(tokenRecord.connection_id)) latestOAuthToken.set(tokenRecord.connection_id, tokenRecord);
  const toolOptions = data.toolNames;
  const visibleCalls = data.calls.filter((call) => {
    const searchable = `${call.tool_name} ${data.workspaceNames[call.workspace_id] || ""} ${connectionNames[call.connection_id || ""] || ""} ${call.request_id || ""} ${call.error_code || ""}`.toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (status === "all" || call.status === status) && (tool === "all" || call.tool_name === tool);
  });
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", String(filters.q));
    if (status !== "all") params.set("status", status);
    if (tool !== "all") params.set("tool", tool);
    if (page > 1) params.set("callPage", String(page));
    const value = params.toString();
    return value ? `/app/platform/mcp?${value}` : "/app/platform/mcp";
  };
  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", String(filters.q));
  if (status !== "all") exportParams.set("status", status);
  if (tool !== "all") exportParams.set("tool", tool);
  const exportHref = `/api/platform/mcp/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;

  return <Stack gap="md">
    <PageHeader title="MCP platform" subtitle="Control rollout, connections and workspace MCP activity without exposing access tokens." />
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm"><Paper withBorder p="md"><Text size="xs" c="dimmed">Active connections</Text><Text size="xl" fw={700}>{active}</Text></Paper><Paper withBorder p="md"><Text size="xs" c="dimmed">Calls · 24h</Text><Text size="xl" fw={700}>{data.metrics.calls}</Text><Text size="xs" c="dimmed">{data.metrics.errors} errors</Text></Paper><Paper withBorder p="md"><Text size="xs" c="dimmed">Latency · 24h</Text><Text size="xl" fw={700}>{data.metrics.p95} ms</Text><Text size="xs" c="dimmed">P50 {data.metrics.p50} ms · P95</Text></Paper><Paper withBorder p="md"><Text size="xs" c="dimmed">Approvals · 24h</Text><Text size="xl" fw={700}>{data.metrics.pendingApprovals}</Text><Text size="xs" c="dimmed">Pending · {data.metrics.failedApprovals} failed</Text></Paper></SimpleGrid>
    {healthIssues.length > 0 ? <Alert color="red" title="MCP health needs attention">{healthIssues.join(" · ")}</Alert> : <Alert color="teal" title="MCP health is normal">No elevated error rate, latency, or failed approved actions in the last 24 hours.</Alert>}
    {!data.canMutate ? <Alert color="blue">Support can inspect MCP activity. Only Super Admin can change rollout settings.</Alert> : null}
    <SectionPanel title="Rollout"><form action={async (formData) => { "use server"; await updateMcpSettingsAction(formData); }}><Group align="center" justify="space-between"><Group><Checkbox name="enabled" label="MCP enabled" defaultChecked={data.settings?.enabled} disabled={!data.canMutate} /><Checkbox name="read_tools_enabled" label="Read tools enabled" defaultChecked={data.settings?.read_tools_enabled} disabled={!data.canMutate} /><Checkbox name="write_tools_enabled" label="Write tools enabled" defaultChecked={data.settings?.write_tools_enabled} disabled={!data.canMutate} /></Group>{data.canMutate ? <Button type="submit" size="compact-sm">Save</Button> : null}</Group></form></SectionPanel>
    <SectionPanel title="Tool call log" padded={false}>
      <form><Group p="sm" align="end"><TextInput name="q" label="Search" placeholder="Workspace, connection, request ID or error" defaultValue={filters.q} style={{ flex: 1 }} /><NativeSelect name="status" label="Status" defaultValue={status} data={[{ value: "all", label: "All statuses" }, { value: "success", label: "Success" }, { value: "error", label: "Error" }]} /><NativeSelect name="tool" label="Tool" defaultValue={tool} data={[{ value: "all", label: "All tools" }, ...toolOptions.map((value) => ({ value, label: value }))]} /><Button type="submit" variant="light">Filter</Button><Button component="a" href={exportHref} variant="light" color="gray">Export CSV</Button><Button component="a" href="/app/platform/mcp" variant="subtle" color="gray">Reset</Button></Group></form>
      <Table><TableThead><TableTr><TableTh>Tool</TableTh><TableTh>Workspace / connection</TableTh><TableTh>Status</TableTh><TableTh>Duration</TableTh><TableTh>Results</TableTh><TableTh>Request</TableTh><TableTh>Time</TableTh><TableTh /></TableTr></TableThead><TableTbody>{visibleCalls.map((call) => <TableTr key={call.id}><TableTd><Text size="sm" fw={600}>{call.tool_name}</Text>{call.error_code ? <Text size="xs" c="red">{call.error_code}</Text> : null}</TableTd><TableTd><Text size="sm">{data.workspaceNames[call.workspace_id] || call.workspace_id}</Text><Text size="xs" c="dimmed">{connectionNames[call.connection_id || ""] || "Unknown connection"}</Text></TableTd><TableTd><Badge variant="light" color={call.status === "success" ? "teal" : "red"}>{call.status}</Badge></TableTd><TableTd>{call.duration_ms} ms</TableTd><TableTd>{call.result_count ?? "—"}</TableTd><TableTd><Text size="xs" ff="monospace">{call.request_id ? `${call.request_id.slice(0, 16)}…` : "—"}</Text></TableTd><TableTd>{new Date(call.created_at).toLocaleString()}</TableTd><TableTd><Button component="a" href={`/app/platform/mcp/calls/${call.id}`} size="compact-xs" variant="subtle">View</Button></TableTd></TableTr>)}</TableTbody></Table>
      {!visibleCalls.length ? <Text p="md" size="sm" c="dimmed">No tool calls match these filters.</Text> : null}
      <Group justify="space-between" p="sm"><Button component="a" href={pageHref(data.callPage - 1)} variant="subtle" disabled={data.callPage <= 1}>Previous</Button><Text size="sm" c="dimmed">Page {data.callPage}</Text><Button component="a" href={pageHref(data.callPage + 1)} variant="subtle" disabled={!data.callHasMore}>Next</Button></Group>
    </SectionPanel>
    <SectionPanel title="Connections" padded={false}><Table><TableThead><TableTr><TableTh>Name</TableTh><TableTh>Workspace</TableTh><TableTh>Authentication</TableTh><TableTh>Scopes</TableTh><TableTh>Status</TableTh><TableTh>Expires</TableTh><TableTh>Last used</TableTh><TableTh /></TableTr></TableThead><TableTbody>{data.connections.map((item) => { const oauth = latestOAuthToken.get(item.id); const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= new Date(data.generatedAt).getTime()); const displayStatus = expired && item.status === "active" ? "expired" : item.status; return <TableTr key={item.id}><TableTd>{item.name}<Text size="xs" c="dimmed">{item.token_prefix}</Text></TableTd><TableTd>{data.workspaceNames[item.workspace_id] || item.workspace_id}</TableTd><TableTd><Badge variant="light" color={oauth ? "blue" : "gray"}>{oauth ? "OAuth 2.1" : "Access token"}</Badge>{oauth ? <Text size="xs" c="dimmed">{oauth.client_id.slice(0, 16)}…</Text> : null}</TableTd><TableTd><Text size="xs">{item.scopes.join(", ")}</Text></TableTd><TableTd><Badge variant="light" color={displayStatus === "active" ? "teal" : displayStatus === "expired" ? "orange" : "gray"}>{displayStatus}</Badge></TableTd><TableTd>{item.expires_at ? new Date(item.expires_at).toLocaleString() : "Never"}</TableTd><TableTd>{item.last_used_at ? new Date(item.last_used_at).toLocaleString() : "Never"}</TableTd><TableTd>{data.canMutate && item.status === "active" ? <form action={revokePlatformMcpConnectionAction}><input type="hidden" name="connection_id" value={item.id} /><Button type="submit" size="compact-sm" variant="subtle" color="red">Revoke</Button></form> : null}</TableTd></TableTr>; })}</TableTbody></Table></SectionPanel>
    <SectionPanel title="OAuth clients" padded={false}><Table><TableThead><TableTr><TableTh>Client</TableTh><TableTh>Redirect URIs</TableTh><TableTh>Status</TableTh><TableTh>Last used</TableTh><TableTh /></TableTr></TableThead><TableTbody>{data.oauthClients.map((client) => <TableTr key={client.client_id}><TableTd>{client.client_name}<Text size="xs" c="dimmed">{client.client_id.slice(0, 22)}…</Text></TableTd><TableTd><Text size="xs">{client.redirect_uris.join(", ")}</Text></TableTd><TableTd><Badge variant="light" color={client.status === "active" ? "teal" : "gray"}>{client.status}</Badge></TableTd><TableTd>{client.last_used_at ? new Date(client.last_used_at).toLocaleString() : "Never"}</TableTd><TableTd>{data.canMutate ? <form action={setMcpOAuthClientStatusAction}><input type="hidden" name="client_id" value={client.client_id} /><input type="hidden" name="status" value={client.status === "active" ? "revoked" : "active"} /><Button type="submit" size="compact-sm" variant="subtle" color={client.status === "active" ? "red" : "teal"}>{client.status === "active" ? "Revoke" : "Reactivate"}</Button></form> : null}</TableTd></TableTr>)}</TableTbody></Table></SectionPanel>
  </Stack>;
}
