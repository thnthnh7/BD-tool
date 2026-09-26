"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Anchor, Badge, Button, Card, Divider, Drawer, Group, NativeSelect, ScrollArea, Stack, Table, Text, UnstyledButton } from "@mantine/core";
import { Check, ExternalLink, FolderOpen } from "lucide-react";
import { DataRecordActions } from "./record-actions";
import { safeDatasetUrl } from "@/features/leads/dataset";
import type { Database, Json } from "@/lib/database.types";
import classes from "./data-library-browser.module.css";

type Collection = Database["public"]["Tables"]["data_collections"]["Row"];
type RecordRow = Database["public"]["Tables"]["data_records"]["Row"];

function object(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function compactDetails(record: RecordRow) {
  const normalized = object(record.normalized_data);
  const raw = object(record.raw_data);
  return [
    string(normalized.email) || string(raw.email),
    string(normalized.phone) || string(raw.phone),
    string(raw.address) || string(raw.location),
    string(raw.category) || string(raw.industry) || string(raw.jobTitle) || string(raw.job_title),
    string(normalized.description),
  ].filter(Boolean).slice(0, 2).join(" · ");
}

export function DataLibraryBrowser({ records, collections, selectedCollection, total, locale, labels, typeLabels, footer }: {
  records: RecordRow[];
  collections: Collection[];
  selectedCollection: string;
  total: number;
  locale: string;
  labels: {
    allCollections: string; collections: string; records: string; dataType: string; details: string; rawData: string; open: string;
    createCompany: string; createContact: string; saved: string; unknownCollection: string;
  };
  typeLabels: Record<string, string>;
  footer: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<RecordRow | null>(null);

  function selectCollection(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("collection", value); else next.delete("collection");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const selected = collections.find((item) => item.id === selectedCollection);
  return <>
    <div className={classes.mobileCollection}>
      <NativeSelect aria-label={labels.allCollections} value={selectedCollection} onChange={(event) => selectCollection(event.currentTarget.value)}
        data={[{ value: "", label: labels.allCollections }, ...collections.map((item) => ({ value: item.id, label: `${item.name} (${item.record_count.toLocaleString(locale)})` }))]} />
    </div>
    <div className={classes.layout}>
      <Card withBorder padding="xs" className={classes.collections}>
        <Stack gap={2}>
          <UnstyledButton className={`${classes.collectionButton} ${!selectedCollection ? classes.collectionActive : ""}`} onClick={() => selectCollection("")}>
            <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600}>{labels.allCollections}</Text><Text size="xs" c="dimmed">{collections.reduce((sum, item) => sum + item.record_count, 0).toLocaleString(locale)}</Text></Group>
          </UnstyledButton>
          {collections.map((item) => <UnstyledButton key={item.id} className={`${classes.collectionButton} ${item.id === selectedCollection ? classes.collectionActive : ""}`} onClick={() => selectCollection(item.id)}>
            <Group gap={8} wrap="nowrap" align="flex-start"><FolderOpen size={15} style={{ flex: "0 0 auto", marginTop: 2 }} /><div style={{ minWidth: 0, flex: 1 }}>
              <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600} truncate>{item.name}</Text><Text size="xs" c="dimmed">{item.record_count.toLocaleString(locale)}</Text></Group>
              <Text size="xs" c="dimmed" truncate>{item.source_actor_id}</Text>
            </div></Group>
          </UnstyledButton>)}
        </Stack>
      </Card>

      <Card withBorder padding={0} className={classes.tableCard}>
        <Group justify="space-between" px="md" py="sm">
          <div><Text fw={650}>{selected?.name || labels.allCollections}</Text><Text size="xs" c="dimmed">{total.toLocaleString(locale)} {labels.records.toLowerCase()}</Text></div>
        </Group>
        <Divider />
        <ScrollArea type="auto">
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
            <Table.Thead><Table.Tr>
              <Table.Th>{labels.records}</Table.Th>
              <Table.Th w={140}>{labels.dataType}</Table.Th>
              <Table.Th>{labels.details}</Table.Th>
              <Table.Th className={classes.hideMobile}>{labels.collections}</Table.Th>
              <Table.Th w={110} />
            </Table.Tr></Table.Thead>
            <Table.Tbody>{records.map((record) => {
              const collection = collections.find((item) => item.id === record.collection_id);
              const summary = compactDetails(record);
              const externalUrl = record.canonical_url ? safeDatasetUrl(record.canonical_url) : null;
              const promoted = Boolean(record.promoted_company_id || record.promoted_contact_id);
              return <Table.Tr key={record.id} className={classes.row} onClick={() => setDetail(record)}>
                <Table.Td className={classes.primaryCell}><Text size="sm" fw={600} truncate>{record.title}</Text><Text size="xs" c="dimmed">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.captured_at))}</Text></Table.Td>
                <Table.Td><Text size="sm">{typeLabels[record.record_type] || record.record_type}</Text></Table.Td>
                <Table.Td className={classes.detailCell}><Text size="sm" c={summary ? undefined : "dimmed"} lineClamp={2}>{summary || "—"}</Text></Table.Td>
                <Table.Td className={classes.hideMobile}><Text size="sm" truncate maw={220}>{collection?.name || labels.unknownCollection}</Text><Text size="xs" c="dimmed" truncate maw={220}>{collection?.source_actor_id}</Text></Table.Td>
                <Table.Td onClick={(event) => event.stopPropagation()}>{promoted ? <Badge size="sm" variant="light" leftSection={<Check size={10} />}>{labels.saved}</Badge> : externalUrl ? <Anchor href={externalUrl} target="_blank" rel="noopener noreferrer" size="xs">{labels.open} <ExternalLink size={10} /></Anchor> : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
              </Table.Tr>;
            })}</Table.Tbody>
          </Table>
        </ScrollArea>
        <Divider />
        <div style={{ padding: "8px 16px" }}>{footer}</div>
      </Card>
    </div>

    <Drawer opened={Boolean(detail)} onClose={() => setDetail(null)} position="right" size="lg" title={<Text fw={700}>{detail?.title}</Text>}>
      {detail ? <Stack gap="md">
        <Group gap={8}><Badge variant="light">{typeLabels[detail.record_type] || detail.record_type}</Badge><Text size="xs" c="dimmed">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.captured_at))}</Text></Group>
        {detail.canonical_url && safeDatasetUrl(detail.canonical_url) ? <Button component="a" href={safeDatasetUrl(detail.canonical_url)!} target="_blank" rel="noopener noreferrer" variant="light" size="xs" rightSection={<ExternalLink size={13} />}>{labels.open}</Button> : null}
        <DataRecordActions recordId={detail.id} companyId={detail.promoted_company_id} contactId={detail.promoted_contact_id}
          companyLabel={labels.createCompany} contactLabel={labels.createContact} savedLabel={labels.saved}
          allowCompany={["organization", "place", "generic_record"].includes(detail.record_type)} allowContact={["person_profile", "generic_record"].includes(detail.record_type)} />
        <Divider />
        <Text size="sm" fw={650}>{labels.rawData}</Text>
        <Card withBorder padding="sm" bg="gray.0"><pre style={{ overflow: "auto", maxHeight: "calc(100vh - 270px)", margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(detail.raw_data, null, 2)}</pre></Card>
      </Stack> : null}
    </Drawer>
  </>;
}
