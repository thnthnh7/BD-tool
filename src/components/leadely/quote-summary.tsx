import { Divider, Stack, Text } from "@mantine/core";
import { StatusBadge } from "@/components/leadely/status-badge";
import { formatVnd } from "@/lib/money";
import type { Client, Quote } from "@/lib/types";
import { SectionPanel } from "./section-panel";

export function QuoteSummary({
  quote,
  client,
  subtotal,
  vat,
  grandTotal,
}: {
  quote: Quote;
  client: Client | null;
  subtotal: number;
  vat: number;
  grandTotal: number;
}) {
  return (
    <SectionPanel title="Tóm tắt">
      <Stack gap="sm">
        <SummaryRow label="Khách hàng" value={client?.companyName || "Chưa chọn"} />
        <SummaryRow label="Hiệu lực" value={quote.validUntil || "—"} />
        <GroupStatus status={quote.status} />
        <Divider color="var(--ld-divider)" />
        <SummaryRow label="Tạm tính" value={formatVnd(subtotal)} />
        <SummaryRow label="Chiết khấu" value={`${quote.discount || 0}%`} />
        <SummaryRow label={`VAT ${quote.vatRate}%`} value={formatVnd(vat)} />
        <SummaryRow label="Tổng" value={formatVnd(grandTotal)} strong />
      </Stack>
    </SectionPanel>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 600} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
    </Stack>
  );
}

function GroupStatus({ status }: { status: string }) {
  return (
    <Stack gap={6}>
      <Text size="xs" c="dimmed">
        Trạng thái
      </Text>
      <StatusBadge status={status} />
    </Stack>
  );
}
