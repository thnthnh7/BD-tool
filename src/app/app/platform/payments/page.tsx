import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
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

export default async function PlatformPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; workspaceId?: string; from?: string; to?: string }>;
}) {
  const context = await requirePlatform();
  const filters = await searchParams;
  const [invoices, workspaces] = await Promise.all([
    loadPlatformPayments(filters),
    loadPlatformWorkspaces(),
  ]);
  const superAdmin = context.platformRole === "super_admin";
  return (
    <Stack gap="md">
      <PageHeader title="Payments" subtitle="Invoices, collections, and manual reconciliation." />
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
