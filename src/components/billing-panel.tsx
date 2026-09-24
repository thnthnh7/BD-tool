"use client";

import { useState } from "react";
import { Alert, Badge, Button, Checkbox, Group, Image, NativeSelect, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { createCheckoutInvoice, initGatewayCheckout } from "@/lib/billing/actions";
import { formatVnd } from "@/lib/money";
import type { ParsedPlan } from "@/lib/entitlements";
import classes from "@/styles/leadely-surfaces.module.css";

type Invoice = {
  id: string;
  payment_code: string;
  amount: number;
  status: string;
  billing_interval: string;
  created_at: string;
};

export function BillingPanel({
  plans,
  invoices,
  currentPlanId,
  canPay,
  qrUrl,
}: {
  plans: ParsedPlan[];
  invoices: Invoice[];
  currentPlanId: string;
  canPay: boolean;
  qrUrl?: string;
}) {
  const pending = invoices.find((item) => item.status === "pending");
  const [error, setError] = useState("");
  const current = plans.find((plan) => plan.id === currentPlanId);

  async function checkout(formData: FormData) {
    setError("");
    const result = await createCheckoutInvoice(formData);
    if (result.error) setError(result.error);
  }

  async function gateway(invoiceId: string) {
    const result = await initGatewayCheckout(invoiceId);
    if (result.error) setError(result.error);
    if (result.url) window.location.href = result.url;
  }

  const paidPlans = plans.filter((plan) => !plan.isFree);

  return (
    <Stack gap="md">
      <PageHeader title="Billing" subtitle="Renew with VietQR or SePay. Recurring is managed in-app." />
      <SectionPanel title="Current plan">
        <Text fw={700}>{current?.name || "—"}</Text>
        <Text size="sm" c="dimmed" mt={4}>
          {current?.isFree ? "Free" : `${formatVnd(current?.priceMonthly || 0)} / month`}
        </Text>
      </SectionPanel>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
        {plans.map((plan) => (
          <SectionPanel key={plan.id} className={plan.id === currentPlanId ? classes.currentPlan : undefined}>
            <Group justify="space-between" wrap="nowrap" gap="xs" mih={22}>
              <Text size="xs" fw={600} c={plan.id === currentPlanId ? "leadely" : "dimmed"}>
                {plan.id === currentPlanId ? "Current plan" : `Plan ${plan.slot}`}
              </Text>
              {plan.badge ? (
                <Badge color="leadely" variant="light">
                  {plan.badge}
                </Badge>
              ) : null}
            </Group>
            <Text fw={700} mt="xs">
              {plan.name}
            </Text>
            <Text fw={700} mt={4} style={{ fontVariantNumeric: "tabular-nums" }}>
              {plan.isFree ? `0 ${"\u20AB"}/mo` : `${formatVnd(plan.priceMonthly)}/mo`}
            </Text>
            <Text size="sm" c="dimmed" mt="auto" pt="xs">
              {plan.quotas.seats < 0 ? "Unlimited seats" : `${plan.quotas.seats} seats`}
            </Text>
          </SectionPanel>
        ))}
      </SimpleGrid>

      {canPay ? (
        <SectionPanel title="Checkout">
          <form action={checkout}>
            <Stack gap="md">
              <Group grow>
                <NativeSelect
                  name="planId"
                  defaultValue={currentPlanId}
                  data={paidPlans.map((plan) => ({
                    value: plan.id,
                    label: `${plan.name} · ${formatVnd(plan.priceMonthly)}/month`,
                  }))}
                />
                <NativeSelect
                  name="interval"
                  data={[
                    { value: "monthly", label: "Monthly" },
                    { value: "yearly", label: "Yearly" },
                  ]}
                />
              </Group>
              <Checkbox name="vat" label="VAT invoice" />
              <TextInput name="vatTaxCode" placeholder="Tax code if requesting VAT" maw={360} />
              <Button type="submit" w="fit-content">
                Create invoice
              </Button>
            </Stack>
          </form>
          {error ? (
            <Alert color="red" mt="md">
              {error}
            </Alert>
          ) : null}
        </SectionPanel>
      ) : (
        <Text size="sm">Only the owner can pay.</Text>
      )}

      {pending ? (
        <SectionPanel title={`Pay ${pending.payment_code}`}>
          <Text fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatVnd(pending.amount)}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                VietQR
              </Text>
              {qrUrl ? (
                <Image src={qrUrl} alt="VietQR" w={224} h={224} radius="md" />
              ) : (
                <Text size="sm" c="dimmed">
                  SePay bank account is not configured.
                </Text>
              )}
              <Text size="sm">
                Transfer note: <strong>{pending.payment_code}</strong>
              </Text>
            </Stack>
            <Stack gap="xs" align="flex-start">
              <Text size="sm" fw={600}>
                Card / NAPAS
              </Text>
              <Text size="sm" c="dimmed">
                Pay by card or NAPAS through the SePay gateway.
              </Text>
              <Button variant="default" onClick={() => gateway(pending.id)}>
                Pay via SePay Gateway
              </Button>
            </Stack>
          </SimpleGrid>
        </SectionPanel>
      ) : null}

      <SectionPanel title="History" padded={invoices.length === 0}>
        {invoices.length === 0 ? (
          <EmptyState compact icon={<Receipt size={14} />} title="No invoices yet" description="Create an invoice above to start a billing period." />
        ) : (
          <div className={classes.tableWrap}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invoices.map((invoice) => (
                  <Table.Tr key={invoice.id}>
                    <Table.Td>
                      <Text size="sm" truncate maw={220}>
                        {invoice.payment_code}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatVnd(invoice.amount)}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={invoice.status === "paid" ? "won" : invoice.status === "pending" ? "sent" : "draft"} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </SectionPanel>
    </Stack>
  );
}
