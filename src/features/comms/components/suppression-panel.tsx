import { Badge, Group, Stack, Text, Textarea } from "@mantine/core";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { ActionForm } from "@/features/crm/components/action-form";
import { addEngagementSuppressionsAction, removeEngagementSuppressionAction } from "@/features/comms/server/suppression-actions";

type Suppression = { id: string; email: string; reason: string; source: string; created_at: string };

export function SuppressionPanel({ items, canManage }: { items: Suppression[]; canManage: boolean }) {
  return <Stack gap="md">
    <Group justify="space-between"><div><Text fw={650}>Do not contact</Text><Text size="xs" c="dimmed">Direct sends and sequence enrollments are blocked for these addresses.</Text></div><Badge variant="light">{items.length}</Badge></Group>
    {canManage ? <ActionForm action={addEngagementSuppressionsAction} submitLabel="Suppress addresses">
      <Textarea name="emails" label="Email addresses" description="Paste up to 500 addresses separated by spaces, commas or new lines." minRows={3} required />
    </ActionForm> : null}
    {items.length ? <Table>
      <TableThead><TableTr><TableTh>Email</TableTh><TableTh>Reason</TableTh><TableTh>Added</TableTh>{canManage ? <TableTh /> : null}</TableTr></TableThead>
      <TableTbody>{items.map((item) => <TableTr key={item.id}>
        <TableTd><Text size="sm" fw={600}>{item.email}</Text></TableTd>
        <TableTd><Text size="sm">{item.reason}</Text></TableTd>
        <TableTd><Text size="sm" c="dimmed">{new Date(item.created_at).toLocaleDateString()}</Text></TableTd>
        {canManage ? <TableTd ta="right"><ActionForm action={removeEngagementSuppressionAction} submitLabel="Remove" variant="light" layout="inline"><input type="hidden" name="id" value={item.id} /></ActionForm></TableTd> : null}
      </TableTr>)}</TableTbody>
    </Table> : <Text size="sm" c="dimmed">No suppressed addresses.</Text>}
  </Stack>;
}
