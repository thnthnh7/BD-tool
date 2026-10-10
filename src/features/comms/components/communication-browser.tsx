"use client";

import { useState } from "react";
import { Badge, Drawer, Group, NativeSelect, ScrollArea, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useLocale } from "next-intl";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { ActionForm } from "@/features/crm/components/action-form";
import { sendCommunicationAction } from "@/features/comms/server/actions";

type Communication = {
  id: string;
  subject: string;
  body: string;
  snippet: string;
  direction: string;
  delivery_status: string;
  from_address: string;
  to_address: string;
  occurred_at: string;
  company_id: string | null;
  contact_id: string | null;
  companies: { name?: string } | null;
};
type Mailbox = { id: string; account_email: string; provider: string };

export function CommunicationBrowser({ items, mailboxes }: { items: Communication[]; mailboxes: Mailbox[] }) {
  const locale = useLocale();
  const [selected, setSelected] = useState<Communication | null>(null);
  return <>
    <Table>
      <TableThead><TableTr><TableTh>Subject</TableTh><TableTh>Direction</TableTh><TableTh>Company</TableTh><TableTh>Status</TableTh><TableTh style={{ whiteSpace: "nowrap" }}>When</TableTh></TableTr></TableThead>
      <TableTbody>{items.map((item) => <TableTr key={item.id} onClick={() => setSelected(item)} style={{ cursor: "pointer" }}>
        <TableTd><Text size="sm" fw={600} lineClamp={1} maw={320}>{item.subject || "(No subject)"}</Text><Text size="xs" c="dimmed" lineClamp={1} maw={320}>{item.snippet || item.body}</Text></TableTd>
        <TableTd><Badge variant="light" color={item.direction === "inbound" ? "blue" : "teal"}>{item.direction}</Badge></TableTd>
        <TableTd><Text size="sm" lineClamp={1}>{item.companies?.name || "—"}</Text></TableTd>
        <TableTd><Text size="sm">{item.delivery_status}</Text></TableTd>
        <TableTd style={{ whiteSpace: "nowrap" }}>{new Date(item.occurred_at).toLocaleString(locale)}</TableTd>
      </TableTr>)}</TableTbody>
    </Table>
    <Drawer opened={Boolean(selected)} onClose={() => setSelected(null)} position="right" size="lg" title={selected?.subject || "Message"}>
      {selected ? <Stack gap="md">
        <Group gap="xs"><Badge variant="light">{selected.direction}</Badge><Badge variant="light" color="gray">{selected.delivery_status}</Badge></Group>
        <Stack gap={2}><Text size="xs" c="dimmed">From</Text><Text size="sm">{selected.from_address || "—"}</Text></Stack>
        <Stack gap={2}><Text size="xs" c="dimmed">To</Text><Text size="sm">{selected.to_address || "—"}</Text></Stack>
        <ScrollArea.Autosize mah={360}><Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.body || selected.snippet || "No message body."}</Text></ScrollArea.Autosize>
        {mailboxes.length ? <Stack gap="xs" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
          <Text fw={650}>Reply</Text>
          <ActionForm action={sendCommunicationAction} submitLabel="Send reply" onSuccess={() => setSelected(null)}>
            <NativeSelect name="account_id" label="Send from" required data={mailboxes.map((account) => ({ value: account.id, label: `${account.account_email} (${account.provider})` }))} />
            <input type="hidden" name="to_address" value={selected.direction === "inbound" ? selected.from_address : selected.to_address} />
            {selected.company_id ? <input type="hidden" name="company_id" value={selected.company_id} /> : null}
            {selected.contact_id ? <input type="hidden" name="contact_id" value={selected.contact_id} /> : null}
            <TextInput name="subject" label="Subject" defaultValue={/^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`} required />
            <Textarea name="body" label="Message" minRows={6} required />
          </ActionForm>
        </Stack> : <Text size="sm" c="dimmed">Connect a mailbox to reply from Bizcraw.</Text>}
      </Stack> : null}
    </Drawer>
  </>;
}
