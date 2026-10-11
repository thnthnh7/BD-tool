"use client";

import { useState } from "react";
import { Alert, Badge, Button, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { createClientWorkspaceAction, switchWorkspaceAction } from "@/lib/auth/actions";

type Workspace = { id: string; name: string; type: string; role: string; providerCostUsd: number };

export function WorkspaceManager({ currentId, workspaces, canCreate }: { currentId: string; workspaces: Workspace[]; canCreate: boolean }) {
  const [error, setError] = useState("");
  async function create(formData: FormData) {
    setError("");
    const result = await createClientWorkspaceAction(formData);
    if (result?.error) setError(result.error);
  }
  return <Stack gap="md">
    <PageHeader title="Client workspaces" subtitle="Keep each client's data, provider usage and sales workflow isolated." />
    <SectionPanel title="Your workspaces">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {workspaces.map((workspace) => <SectionPanel key={workspace.id} title={workspace.name}>
          <Group justify="space-between"><Badge variant="light">{workspace.role}</Badge><Text size="xs" c="dimmed">Provider cost ${workspace.providerCostUsd.toFixed(2)}</Text></Group>
          <Text size="sm" c="dimmed" mt="xs">{workspace.type === "company" ? "Client/company workspace" : "Personal workspace"}</Text>
          {workspace.id === currentId ? <Button mt="md" disabled>Current workspace</Button> : <form action={async (formData) => { await switchWorkspaceAction(formData); }}><input type="hidden" name="workspace_id" value={workspace.id} /><Button mt="md" type="submit" variant="light">Open workspace</Button></form>}
        </SectionPanel>)}
      </SimpleGrid>
    </SectionPanel>
    {canCreate ? <SectionPanel title="Add client workspace">
      <Text size="sm" c="dimmed" mb="md">Creates an isolated company workspace on the Free plan. Billing and provider credentials remain separate for each client.</Text>
      <form action={create}><Group align="end"><TextInput name="name" label="Client or workspace name" required style={{ flex: 1 }} /><Button type="submit">Create workspace</Button></Group></form>
      {error ? <Alert color="red" mt="md">{error}</Alert> : null}
    </SectionPanel> : null}
  </Stack>;
}
