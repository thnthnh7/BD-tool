"use client";

import { useMemo, useState } from "react";
import { Alert, Button, FileButton, Group, Stack, Table, Text, Textarea, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { EntityRow } from "@/components/leadely/entity-row";
import { EmptyState } from "@/components/leadely/empty-state";
import { FieldLabel } from "@/components/ui";
import { createClientAction, updateClientLogoAction } from "@/lib/db/actions";
import { fileToCompressedDataUrl } from "@/lib/image";
import type { Client } from "@/lib/types";
import { Users } from "lucide-react";
import classes from "@/styles/leadely-surfaces.module.css";

const empty = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  taxCode: "",
  address: "",
  representativeTitle: "",
  authorizationDoc: "",
  logoUrl: "",
  industry: "",
  notes: "",
};

export function ClientsPanel({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function addClient() {
    setError("");
    const result = await createClientAction(form);
    if (result.error || !result.client) {
      setError(result.error || "Lỗi");
      return;
    }
    setClients([result.client, ...clients]);
    setForm(empty);
  }

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return clients;
    return clients.filter((client) => `${client.companyName} ${client.contactName} ${client.email}`.toLowerCase().includes(value));
  }, [clients, query]);

  return (
    <Stack gap="md">
      <PageHeader title="Clients" subtitle="Company and contact records used on quotes and contracts." />
      <SectionPanel title="Add client">
        <Stack gap="md">
          <Group grow>
            <div>
              <FieldLabel>Company</FieldLabel>
              <TextInput value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.currentTarget.value })} />
            </div>
            <div>
              <FieldLabel>Contact</FieldLabel>
              <TextInput value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.currentTarget.value })} />
            </div>
          </Group>
          <Group grow>
            <TextInput placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.currentTarget.value })} />
            <TextInput placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })} />
          </Group>
          <TextInput placeholder="Tax code" value={form.taxCode} onChange={(event) => setForm({ ...form, taxCode: event.currentTarget.value })} />
          <TextInput placeholder="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.currentTarget.value })} />
          <Textarea placeholder="Notes" minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })} />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button onClick={addClient} w="fit-content">
            Save client
          </Button>
        </Stack>
      </SectionPanel>

      <SectionPanel title="Directory" padded={false}>
        <Group px="lg" pt="md" pb="sm">
          <TextInput placeholder="Search clients" value={query} onChange={(event) => setQuery(event.currentTarget.value)} w={280} />
        </Group>
        {filtered.length ? (
          <div className={classes.tableWrap}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>Contact</Table.Th>
                  <Table.Th>Logo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((client) => (
                  <Table.Tr key={client.id}>
                    <Table.Td>
                      <EntityRow title={client.companyName} subtitle={client.industry || client.taxCode} image={client.logoUrl} initials={client.companyName.slice(0, 2).toUpperCase()} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{client.contactName || "—"}</Text>
                      <Text size="xs" c="dimmed">
                        {[client.email, client.phone].filter(Boolean).join(" · ") || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <FileButton
                        accept="image/*"
                        onChange={async (file) => {
                          if (!file) return;
                          const logoUrl = await fileToCompressedDataUrl(file);
                          await updateClientLogoAction(client.id, logoUrl);
                          setClients(clients.map((item) => (item.id === client.id ? { ...item, logoUrl } : item)));
                        }}
                      >
                        {(props) => (
                          <Button {...props} variant="subtle" size="compact-md">
                            Upload
                          </Button>
                        )}
                      </FileButton>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={<Users size={18} />} title="No clients yet" description="Add a company to start quoting." />
        )}
      </SectionPanel>
    </Stack>
  );
}
