import { Alert, Badge, Button, Checkbox, Group, NativeSelect, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { requirePlatform } from "@/lib/auth/session";
import { loadPlatformPayments, loadPlatformWorkspaces } from "@/lib/platform/actions";
import { VoidForm } from "@/components/platform/void-form";
import { cancelInvoiceAction, markInvoicePaidAction } from "@/lib/platform/ops";
import { formatVnd } from "@/lib/money";
import classes from "@/styles/leadely-surfaces.module.css";
import { loadBillingProviderAdminConfigs, updateBillingProviderConfigAction } from "@/lib/billing/platform-config-actions";

type ProviderView = Awaited<ReturnType<typeof loadBillingProviderAdminConfigs>>["providers"][number];

const providerNames = { stripe: "Stripe", paypal: "PayPal", sepay: "SePay / VietQR" } as const;

function SecretField({ name, label, configured, disabled }: { name: string; label: string; configured?: boolean; disabled: boolean }) {
  return <PasswordInput name={name} label={label} placeholder={configured ? "Configured · leave blank to keep" : `Enter ${label.toLowerCase()}`} autoComplete="new-password" disabled={disabled} />;
}

function ProviderSettings({ item, canMutate }: { item: ProviderView; canMutate: boolean }) {
  const readyCount = Object.values(item.configuredCredentials).filter(Boolean).length;
  const totalSecrets = Object.keys(item.configuredCredentials).length;
  return (
    <Paper withBorder radius="md" p="md">
      <form action={updateBillingProviderConfigAction}>
        <input type="hidden" name="provider" value={item.provider} />
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Group gap="xs"><Text fw={700}>{providerNames[item.provider]}</Text><Badge variant="light" color={item.enabled ? "teal" : "gray"}>{item.enabled ? "Enabled" : "Disabled"}</Badge></Group>
            <Text size="xs" c="dimmed">{item.source === "database" ? "Managed here" : item.source === "environment" ? "Using environment fallback" : "Not configured"} · {readyCount}/{totalSecrets} secrets ready</Text>
          </div>
          <Checkbox name="enabled" label="Accept payments" defaultChecked={item.enabled} disabled={!canMutate} />
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput name="accountLabel" label={item.provider === "sepay" ? "Account label" : "Merchant account label"} defaultValue={item.accountLabel} placeholder="Production merchant account" disabled={!canMutate} />
          <NativeSelect name="mode" label="Mode" defaultValue={item.mode} data={[{ value: "test", label: item.provider === "paypal" ? "Sandbox" : "Test" }, { value: "live", label: "Live" }]} disabled={!canMutate} />
          {item.provider === "stripe" ? <>
            <SecretField name="secretKey" label="Secret key" configured={item.configuredCredentials.secretKey} disabled={!canMutate} />
            <SecretField name="webhookSecret" label="Webhook secret" configured={item.configuredCredentials.webhookSecret} disabled={!canMutate} />
          </> : null}
          {item.provider === "paypal" ? <>
            <TextInput name="merchantEmail" label="PayPal merchant email" defaultValue={item.public.merchantEmail || ""} disabled={!canMutate} />
            <SecretField name="clientId" label="Client ID" configured={item.configuredCredentials.clientId} disabled={!canMutate} />
            <SecretField name="clientSecret" label="Client secret" configured={item.configuredCredentials.clientSecret} disabled={!canMutate} />
            <SecretField name="webhookId" label="Webhook ID" configured={item.configuredCredentials.webhookId} disabled={!canMutate} />
          </> : null}
          {item.provider === "sepay" ? <>
            <TextInput name="accountHolder" label="Account holder" defaultValue={item.public.accountHolder || ""} disabled={!canMutate} />
            <TextInput name="bankAccount" label="Bank account number" defaultValue={item.public.bankAccount || ""} disabled={!canMutate} />
            <TextInput name="bankName" label="Bank code / name" defaultValue={item.public.bankName || ""} placeholder="vietcombank" disabled={!canMutate} />
            <TextInput name="bankBin" label="Bank BIN" defaultValue={item.public.bankBin || ""} disabled={!canMutate} />
            <SecretField name="merchantId" label="Merchant ID" configured={item.configuredCredentials.merchantId} disabled={!canMutate} />
            <SecretField name="secretKey" label="Secret key" configured={item.configuredCredentials.secretKey} disabled={!canMutate} />
            <SecretField name="webhookSecret" label="Webhook secret" configured={item.configuredCredentials.webhookSecret} disabled={!canMutate} />
          </> : null}
        </SimpleGrid>
        {canMutate ? <Group justify="flex-end" mt="md"><Button type="submit" size="compact-sm">Save {providerNames[item.provider]}</Button></Group> : null}
      </form>
    </Paper>
  );
}

export default async function PlatformPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; workspaceId?: string; from?: string; to?: string }>;
}) {
  const context = await requirePlatform();
  const filters = await searchParams;
  const [invoices, workspaces, providerData] = await Promise.all([
    loadPlatformPayments(filters),
    loadPlatformWorkspaces(),
    loadBillingProviderAdminConfigs(),
  ]);
  const superAdmin = context.platformRole === "super_admin";
  return (
    <Stack gap="md">
      <PageHeader title="Payments" subtitle="Invoices, collections, and manual reconciliation." />
      {!superAdmin ? <Alert color="blue">Support accounts can inspect payment destinations. Only a super admin can change credentials.</Alert> : null}
      <SectionPanel title="Payment destinations">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Configure the merchant accounts that receive subscription payments. Saved secrets are encrypted and are never displayed again. Database settings take effect immediately; existing environment variables remain as fallback.</Text>
          <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="sm">
            {providerData.providers.map((item) => <ProviderSettings key={item.provider} item={item} canMutate={providerData.canMutate} />)}
          </SimpleGrid>
        </Stack>
      </SectionPanel>
      <SectionPanel title="Filters">
        <form>
          <Group align="flex-end">
            <NativeSelect
              name="status"
              label="Status"
              data={["", "pending", "paid", "expired", "cancelled"]}
              defaultValue={filters.status || ""}
            />
            <NativeSelect
              name="workspaceId"
              label="Workspace"
              data={[{ value: "", label: "All" }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))]}
              defaultValue={filters.workspaceId || ""}
            />
            <TextInput name="from" type="date" label="From" defaultValue={filters.from || ""} />
            <TextInput name="to" type="date" label="To" defaultValue={filters.to || ""} />
            <Button type="submit">Filter</Button>
          </Group>
        </form>
      </SectionPanel>
      <SectionPanel title="Invoices" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Workspace</TableTh>
                <TableTh>Code</TableTh>
                <TableTh ta="right">Amount</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Payment</TableTh>
                <TableTh />
              </TableTr>
            </TableThead>
            <TableTbody>
              {invoices.map((invoice) => (
                <TableTr key={invoice.id}>
                  <TableTd>{invoice.workspaceName}</TableTd>
                  <TableTd>
                    <Text size="sm" truncate maw={180}>
                      {invoice.payment_code}
                    </Text>
                  </TableTd>
                  <TableTd ta="right">{formatVnd(invoice.amount)}</TableTd>
                  <TableTd>
                    <StatusBadge status={invoice.status === "paid" ? "won" : invoice.status === "pending" ? "sent" : "draft"} />
                  </TableTd>
                  <TableTd>
                    {invoice.payments.map((payment) => (
                      <Text key={payment.sepay_id} size="xs">
                        {payment.channel} · {payment.sepay_id} · {formatVnd(payment.amount)}
                      </Text>
                    ))}
                  </TableTd>
                  <TableTd>
                    {superAdmin && invoice.status === "pending" ? (
                      <Group gap="xs">
                        <VoidForm action={markInvoicePaidAction}>
                          <input type="hidden" name="id" value={invoice.id} />
                          <Button type="submit" size="compact-sm">
                            Mark paid
                          </Button>
                        </VoidForm>
                        <VoidForm action={cancelInvoiceAction}>
                          <input type="hidden" name="id" value={invoice.id} />
                          <Button type="submit" variant="subtle" color="red" size="compact-sm">
                            Cancel
                          </Button>
                        </VoidForm>
                      </Group>
                    ) : null}
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      </SectionPanel>
    </Stack>
  );
}
