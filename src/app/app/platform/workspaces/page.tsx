import Link from "next/link";
import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { requirePlatform } from "@/lib/auth/session";
import { VoidForm } from "@/components/platform/void-form";
import { loadPlatformWorkspaces, lockWorkspaceAction } from "@/lib/platform/actions";
import classes from "@/styles/leadely-surfaces.module.css";

export default async function PlatformWorkspacesPage() {
  const context = await requirePlatform();
  const workspaces = await loadPlatformWorkspaces();
  const superAdmin = context.platformRole === "super_admin";
  return (
    <Stack gap="md">
      <PageHeader title="Workspaces" subtitle="Lock or unlock tenant workspaces." />
      <SectionPanel title="All workspaces" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Workspace</TableTh>
                <TableTh>Status</TableTh>
                <TableTh />
              </TableTr>
            </TableThead>
            <TableTbody>
              {workspaces.map((workspace) => (
                <TableTr key={workspace.id}>
                  <TableTd>
                    <Text size="sm" fw={600} truncate maw={320}>
                      <Link href={`/app/platform/workspaces/${workspace.id}`}>{workspace.name}</Link>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {workspace.type}
                      {workspace.archived_at ? " · archived" : ""} · {workspace.plan_status}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Group gap={6} wrap="nowrap">
                      <StatusBadge status={workspace.plan_status} />
                      {workspace.locked ? (
                        <Badge color="red" variant="light">
                          Locked
                        </Badge>
                      ) : null}
                    </Group>
                  </TableTd>
                  <TableTd ta="right">
                    {superAdmin ? (
                      <VoidForm action={lockWorkspaceAction}>
                        <input type="hidden" name="id" value={workspace.id} />
                        <input type="hidden" name="locked" value={String(workspace.locked)} />
                        <Button type="submit" variant="subtle" size="compact-md">
                          {workspace.locked ? "Unlock" : "Lock"}
                        </Button>
                      </VoidForm>
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
