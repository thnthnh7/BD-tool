import Link from "next/link";
import { Badge, Card, Group, Progress, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadMarketingDashboard } from "@/lib/platform/marketing";

function change(current: number, previous: number) { return previous ? (current - previous) / previous : current ? 1 : 0; }
function Metric({ label, value, delta }: { label: string; value: string; delta: number }) {
  return <Card withBorder radius="md" padding="md"><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text><Group justify="space-between" align="flex-end" mt={6}><Text size="xl" fw={800}>{value}</Text><Badge color={delta >= 0 ? "teal" : "red"} variant="light">{delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}%</Badge></Group></Card>;
}
function Ranking({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((row) => row[1]));
  return <Stack gap="sm">{rows.length ? rows.map(([label, count]) => <div key={label}><Group justify="space-between" gap="sm" mb={4}><Text size="sm" truncate>{label}</Text><Text size="sm" fw={700}>{count}</Text></Group><Progress value={(count / max) * 100} size="sm" color="teal" /></div>) : <Text size="sm" c="dimmed">No data in this period.</Text>}</Stack>;
}

export default async function PlatformMarketingPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = Number(params.days || 30);
  const data = await loadMarketingDashboard(days);
  const c = data.current, p = data.previous;
  const funnel = [["Visitors", c.visitors], ["Signup intent", c.signups], ["Workspaces created", c.workspaces], ["Paid activated", c.paid]] as const;
  return <Stack gap="md">
    <PageHeader title="Marketing" subtitle="Consent-based website traffic, acquisition, content and conversion performance." />
    <Group gap="xs">{[7, 30, 90].map((value) => <Badge key={value} component={Link} href={`/app/platform/marketing?days=${value}`} variant={data.days === value ? "filled" : "light"} color="teal" size="lg">{value} days</Badge>)}</Group>
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
      <Metric label="Unique visitors" value={String(c.visitors)} delta={change(c.visitors, p.visitors)} />
      <Metric label="Sessions" value={String(c.sessions)} delta={change(c.sessions, p.sessions)} />
      <Metric label="Pageviews" value={String(c.pageviews)} delta={change(c.pageviews, p.pageviews)} />
      <Metric label="Avg. engagement" value={`${c.avgEngagementSeconds.toFixed(0)}s`} delta={change(c.avgEngagementSeconds, p.avgEngagementSeconds)} />
      <Metric label="Engagement rate" value={`${(c.engagementRate * 100).toFixed(1)}%`} delta={change(c.engagementRate, p.engagementRate)} />
      <Metric label="Pages / session" value={c.pagesPerSession.toFixed(2)} delta={change(c.pagesPerSession, p.pagesPerSession)} />
      <Metric label="Workspace conversion" value={`${c.visitors ? (c.workspaces / c.visitors * 100).toFixed(1) : "0.0"}%`} delta={change(c.workspaces, p.workspaces)} />
      <Metric label="Paid activations" value={String(c.paid)} delta={change(c.paid, p.paid)} />
    </SimpleGrid>
    <SimpleGrid cols={{ base: 1, lg: 2 }}><SectionPanel title="Acquisition channels"><Ranking rows={data.channels} /></SectionPanel><SectionPanel title="Top sources"><Ranking rows={data.sources} /></SectionPanel></SimpleGrid>
    <SimpleGrid cols={{ base: 1, lg: 3 }}><SectionPanel title="Campaigns"><Ranking rows={data.campaigns} /></SectionPanel><SectionPanel title="Countries"><Ranking rows={data.countries} /></SectionPanel><SectionPanel title="Devices"><Ranking rows={data.devices} /></SectionPanel></SimpleGrid>
    <SectionPanel title="Conversion funnel"><SimpleGrid cols={{ base: 2, md: 4 }}>{funnel.map(([label, count], index) => <Card key={label} withBorder radius="md"><Text size="xs" c="dimmed">{label}</Text><Text size="xl" fw={800} mt={4}>{count}</Text>{index ? <Text size="xs" c="dimmed">{funnel[index - 1][1] ? (count / funnel[index - 1][1] * 100).toFixed(1) : "0.0"}% from previous step</Text> : null}</Card>)}</SimpleGrid></SectionPanel>
    <SectionPanel title="Landing page performance" padded={false}><Table.ScrollContainer minWidth={700}><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Landing page</Table.Th><Table.Th>Sessions</Table.Th><Table.Th>Pageviews</Table.Th><Table.Th>Avg. engagement</Table.Th><Table.Th>Bounce rate</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.content.map((row) => <Table.Tr key={row.path}><Table.Td>{row.path}</Table.Td><Table.Td>{row.sessions}</Table.Td><Table.Td>{row.pageviews}</Table.Td><Table.Td>{(row.engagement / Math.max(1, row.sessions) / 1000).toFixed(0)}s</Table.Td><Table.Td>{(row.bounced / Math.max(1, row.sessions) * 100).toFixed(1)}%</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></SectionPanel>
    <Text size="xs" c="dimmed">Only consented public-site activity is included. Server-verified workspace and paid events cannot be created from the browser.</Text>
  </Stack>;
}
