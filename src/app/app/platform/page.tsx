import Link from "next/link";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { requirePlatform } from "@/lib/auth/session";
import { syncApifyCatalogAction } from "@/lib/platform/actions";
import { loadPlatformDashboard } from "@/lib/platform/ops";
import { formatVnd } from "@/lib/money";

export const maxDuration = 300;

export default async function PlatformOverviewPage() {
  const context = await requirePlatform();
  const data = await loadPlatformDashboard();
  const cards = [
    ["Trialing", data.statusCounts.trialing],
    ["Active", data.statusCounts.active],
    ["Past due", data.statusCounts.past_due],
    ["Expired", data.statusCounts.expired],
    ["Canceled", data.statusCounts.canceled],
    ["Locked", data.lockedCount],
    ["New in 7 days", data.newCount],
  ];
  return (
    <Stack gap="md">
      <PageHeader title="Overview" subtitle="Tenant health, cash collected, and jobs that need attention." />
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {cards.map(([label, value]) => (
          <SectionPanel key={String(label)} title={String(label)}>
            <Text fw={700} size="xl">
              {value}
            </Text>
          </SectionPanel>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SectionPanel title="Money this month">
          <Text size="sm">Pending invoices: {data.pendingCount}</Text>
          <Text size="sm">Paid invoices: {data.paidCount} · {formatVnd(data.paidAmount)}</Text>
          <Text size="sm">Collected: {formatVnd(data.collected)}</Text>
        </SectionPanel>
        <SectionPanel title="Usage this period">
          <Text size="sm">Quotes {data.usageTotals.quotes_created}</Text>
          <Text size="sm">AI briefs {data.usageTotals.ai_briefs}</Text>
          <Text size="sm">Scrapes {data.usageTotals.maps_scrapes} · places {data.usageTotals.maps_places} · people {data.usageTotals.maps_people}</Text>
          {data.nearQuota.slice(0, 8).map((row) => (
            <Text key={`${row.id}-${row.field}`} size="sm">
              <Link href={`/app/platform/workspaces/${row.id}`}>{row.name}</Link> {row.field} {row.used}/{row.limit}
            </Text>
          ))}
        </SectionPanel>
        {context.platformRole === "super_admin" ? (
          <SectionPanel title="Actor catalog">
            <Text size="sm" mb="sm">
              Kéo toàn bộ actor lead generation từ Apify Store vào catalog. Nguồn đã sẵn sàng giữ trạng thái của nó.
            </Text>
            <ActionForm action={syncApifyCatalogAction} submitLabel="Đồng bộ catalog" variant="light">
              {null}
            </ActionForm>
          </SectionPanel>
        ) : null}
        <SectionPanel title="Scrape jobs">
          <Text size="sm">Queued {data.scrapeCounts.queued} · running {data.scrapeCounts.running} · ingesting {data.scrapeCounts.ingesting}</Text>
          <Text size="sm">Failed in 24h {data.failedRecent} · stuck over 15m {data.stuck}</Text>
        </SectionPanel>
        <SectionPanel title="Needs attention">
          {data.attention.length === 0 ? <Text size="sm">Nothing waiting.</Text> : null}
          {data.attention.map((item, index) => (
            <Text key={`${item.href}-${index}`} size="sm">
              <Link href={item.href}>{item.label}</Link> · {item.detail}
            </Text>
          ))}
        </SectionPanel>
      </SimpleGrid>
    </Stack>
  );
}
