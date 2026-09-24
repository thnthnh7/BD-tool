import { Stack, Text } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { loadPlatformAudit } from "@/lib/platform/ops";
import classes from "@/styles/leadely-surfaces.module.css";

export default async function PlatformAuditPage() {
  const rows = await loadPlatformAudit();
  return (
    <Stack gap="md">
      <PageHeader title="Audit" subtitle="Platform actions, newest first." />
      <SectionPanel title="Log" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>When</TableTh>
                <TableTh>Who</TableTh>
                <TableTh>Action</TableTh>
                <TableTh>Target</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {rows.map((row) => (
                <TableTr key={row.id}>
                  <TableTd>{new Date(row.created_at).toLocaleString()}</TableTd>
                  <TableTd>{row.actorEmail || "—"}</TableTd>
                  <TableTd>{row.action}</TableTd>
                  <TableTd>
                    <Text size="xs">
                      {row.entity_type}
                      {row.entity_id ? ` ${row.entity_id}` : ""}
                    </Text>
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
