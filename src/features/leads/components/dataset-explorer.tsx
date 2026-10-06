"use client";

import { useMemo, useState } from "react";
import { Anchor, Badge, Box, Button, Checkbox, Code, Drawer, Group, Menu, Pagination, Popover, ScrollArea, Select, Stack, Table, Tabs, Text, TextInput, UnstyledButton } from "@mantine/core";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, Search, SquareArrowOutUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import type { Json } from "@/lib/database.types";
import { datasetColumns, datasetCsv, datasetRecord, datasetValue, defaultDatasetColumns, filterDataset, safeDatasetUrl, sortDataset, type DatasetRow } from "@/features/leads/dataset";
import classes from "./dataset-explorer.module.css";

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Value({ value, onExpand }: { value: Json | undefined; onExpand?: () => void }) {
  const t = useTranslations("Dataset");
  const locale = useLocale() as AppLocale;
  if (value == null || value === "") return <Text c="dimmed" size="sm">—</Text>;
  if (typeof value === "boolean") return <Badge color={value ? "teal" : "gray"}>{value ? t("yes") : t("no")}</Badge>;
  if (typeof value === "object") {
    const label = Array.isArray(value) ? t("itemCount", { count: formatNumber(value.length, locale) }) : t("fieldCount", { count: formatNumber(Object.keys(value).length, locale) });
    return onExpand ? <Button variant="subtle" size="compact-sm" onClick={onExpand}>{label}</Button> : <Text size="sm">{label}</Text>;
  }
  const url = typeof value === "string" ? safeDatasetUrl(value) : null;
  if (url) return <Anchor href={url} target="_blank" rel="noopener noreferrer" size="sm" lineClamp={2}>{String(value)}</Anchor>;
  return <Text size="sm" lineClamp={3}>{typeof value === "number" ? formatNumber(value, locale) : value}</Text>;
}

/** Nested arrays have their own paging and item details; never flatten away the parent record. */
function NestedArray({ values }: { values: Json[] }) {
  const t = useTranslations("Dataset");
  const locale = useLocale() as AppLocale;
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<number | null>(null);
  const rows = useMemo(() => values.map((value, index) => ({ id: String(index), label: String(index + 1), data: datasetRecord(value) })), [values]);
  const columns = useMemo(() => datasetColumns(rows).filter((column) => column.path.length === 1), [rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  return <Stack gap="xs">
    <Text size="xs" c="dimmed">{t("nestedItems", { count: formatNumber(values.length, locale) })}</Text>
    <Box className={classes.nested}>
      <Table withTableBorder horizontalSpacing="xs" verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>#</Table.Th>{columns.map((column) => <Table.Th key={column.key}>{column.label}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>{rows.slice((page - 1) * 10, page * 10).map((row) => <Table.Tr key={row.id}>
          <Table.Td><Button variant="subtle" size="compact-xs" onClick={() => setDetail(Number(row.id))}>{row.label}</Button></Table.Td>
          {columns.map((column) => <Table.Td key={column.key} miw={140}><Value value={datasetValue(row.data, column.path)} onExpand={() => setDetail(Number(row.id))} /></Table.Td>)}
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Box>
    {pageCount > 1 && <Pagination size="sm" total={pageCount} value={page} onChange={setPage} />}
    {detail !== null && <Box><Group justify="space-between"><Text size="sm" fw={600}>{t("itemNumber", { number: detail + 1 })}</Text><Button size="compact-xs" variant="subtle" onClick={() => setDetail(null)}>{t("close")}</Button></Group><Code block className={classes.json}>{JSON.stringify(values[detail], null, 2)}</Code></Box>}
  </Stack>;
}

function DetailValue({ value }: { value: Json | undefined }) {
  const t = useTranslations("Dataset");
  if (Array.isArray(value)) return value.length ? <NestedArray values={value} /> : <Text c="dimmed" size="sm">{t("emptyList")}</Text>;
  if (value && typeof value === "object") return <Code block className={classes.json}>{JSON.stringify(value, null, 2)}</Code>;
  if (typeof value === "string" && !safeDatasetUrl(value)) return <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{value || "—"}</Text>;
  return <Value value={value} />;
}

export function DatasetExplorer({ rows, filename, emptyMessage }: { rows: DatasetRow[]; filename: string; emptyMessage?: string }) {
  const t = useTranslations("Dataset");
  const locale = useLocale() as AppLocale;
  const resolvedEmpty = emptyMessage ?? t("emptyDefault");
  const columns = useMemo(() => datasetColumns(rows), [rows]);
  const defaults = useMemo(() => defaultDatasetColumns(columns), [columns]);
  const [selection, setSelection] = useState<string[] | null>(null);
  const [columnQuery, setColumnQuery] = useState("");
  const [query, setQuery] = useState("");
  const [field, setField] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("20");
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<string | null>(null);
  const selected = selection ?? defaults;
  const visible = columns.filter((column) => selected.includes(column.key));
  const matched = useMemo(() => filterDataset(rows, query, columns.find((column) => column.key === field)), [rows, query, field, columns]);
  const ordered = useMemo(() => sortDataset(matched, columns.find((column) => column.key === sort?.key), sort?.desc ?? false), [matched, columns, sort]);
  const totalPages = Math.max(1, Math.ceil(ordered.length / Number(pageSize)));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * Number(pageSize);
  const detail = rows.find((row) => row.id === detailId);
  const focusedColumn = columns.find((column) => column.key === focusField);
  const fields = detail ? Object.entries(detail.data) : [];
  function openDetail(row: DatasetRow, column?: string) { setDetailId(row.id); setFocusField(column ?? null); }

  return <>
    <Stack gap="sm" className={classes.toolbar}>
      <Group justify="space-between" gap="sm">
        <Group gap="xs" style={{ flex: 1 }}>
          <TextInput aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} leftSection={<Search size={15} />} value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1); }} style={{ flex: 1, minWidth: 180 }} />
          <Select aria-label={t("searchField")} placeholder={t("allFields")} clearable searchable value={field} data={columns.map((column) => ({ value: column.key, label: column.label }))} onChange={(value) => { setField(value); setPage(1); }} w={200} />
        </Group>
        <Group gap="xs">
          <Popover width={320} position="bottom-end" shadow="md">
            <Popover.Target><Button variant="default" leftSection={<Columns3 size={15} />}>{t("columns", { count: visible.length })}</Button></Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm">
                <Group justify="space-between"><Text fw={600} size="sm">{t("dataFields")}</Text><Button variant="subtle" size="compact-xs" onClick={() => setSelection(null)}>{t("defaultColumns")}</Button></Group>
                <TextInput placeholder={t("searchColumns")} aria-label={t("searchColumnsLabel")} value={columnQuery} onChange={(event) => setColumnQuery(event.currentTarget.value)} />
                <ScrollArea h={260}><Checkbox.Group value={selected} onChange={(value) => { if (value.length) setSelection(value); }}><Stack gap="xs">{columns.filter((column) => column.label.toLowerCase().includes(columnQuery.toLowerCase())).map((column) => <Checkbox key={column.key} value={column.key} label={column.label} />)}</Stack></Checkbox.Group></ScrollArea>
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Menu position="bottom-end">
            <Menu.Target><Button variant="light" leftSection={<Download size={15} />} disabled={!matched.length}>{t("export")}</Button></Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{t("filteredRecords", { count: formatNumber(matched.length, locale) })}</Menu.Label>
              <Menu.Item onClick={() => download(datasetCsv(ordered, visible), `${filename}.csv`, "text/csv;charset=utf-8")}>{t("csvVisible")}</Menu.Item>
              <Menu.Item onClick={() => download(JSON.stringify(ordered.map((row) => row.data), null, 2), `${filename}.json`, "application/json")}>{t("jsonAll")}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <Text size="xs" c="dimmed">{t("summary", { records: rows.length, fields: columns.filter((column) => column.path.length === 1).length })}</Text>
    </Stack>
    {ordered.length ? <Box className={classes.tableViewport}>
      <Table className={classes.table}>
        <Table.Thead><Table.Tr><Table.Th className={classes.rowNumber}>#</Table.Th>{visible.map((column) => <Table.Th key={column.key} aria-sort={sort?.key === column.key ? sort.desc ? "descending" : "ascending" : "none"}>
          <UnstyledButton className={classes.sortButton} onClick={() => { setSort({ key: column.key, desc: sort?.key === column.key ? !sort.desc : false }); setPage(1); }}><Group gap={6} wrap="nowrap">{column.label}{sort?.key === column.key ? sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : <ArrowUpDown size={12} />}</Group></UnstyledButton>
        </Table.Th>)}<Table.Th>{t("details")}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{ordered.slice(offset, offset + Number(pageSize)).map((row, index) => <Table.Tr key={row.id}>
          <Table.Td className={classes.rowNumber}>{offset + index + 1}</Table.Td>
          {visible.map((column) => <Table.Td className={classes.cell} key={column.key}><Value value={datasetValue(row.data, column.path)} onExpand={() => openDetail(row, column.key)} /></Table.Td>)}
          <Table.Td><Button size="compact-sm" variant="subtle" aria-label={t("detailsNamed", { name: row.label })} onClick={() => openDetail(row)}><SquareArrowOutUpRight size={15} /></Button></Table.Td>
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Box> : <Stack align="center" gap={6} py={48} px="md"><Search size={22} /><Text fw={600} size="sm">{rows.length ? t("noMatch") : t("noResults")}</Text><Text size="sm" c="dimmed">{rows.length ? t("tryAnother") : resolvedEmpty}</Text>{query && <Button variant="subtle" size="compact-sm" onClick={() => { setQuery(""); setField(null); }}>{t("clearFilters")}</Button>}</Stack>}
    <Group justify="space-between" p="md" gap="sm">
      <Text size="sm" c="dimmed">{t("range", { from: ordered.length ? offset + 1 : 0, to: Math.min(offset + Number(pageSize), ordered.length), total: formatNumber(ordered.length, locale) })}</Text>
      <Group><Select aria-label={t("rowsPerPage")} w={115} value={pageSize} data={["20", "50", "100"].map((count) => ({ value: count, label: t("rows", { count }) }))} onChange={(value) => { setPageSize(value || "20"); setPage(1); }} /><Pagination size="sm" total={totalPages} value={currentPage} onChange={setPage} /></Group>
    </Group>
    <Drawer opened={Boolean(detail)} onClose={() => setDetailId(null)} position="right" size="lg" title={<Text fw={600}>{t("recordDetails")}</Text>} classNames={{ body: classes.details }}>
      {detail && <Stack>
        <Text fw={600}>{detail.label}</Text>
        <Tabs key={`${detail.id}-${focusField}`} defaultValue="fields">
          <Tabs.List><Tabs.Tab value="fields">{t("data")}</Tabs.Tab><Tabs.Tab value="json">JSON</Tabs.Tab></Tabs.List>
          <Tabs.Panel value="fields" pt="md">
            {focusedColumn ? <Stack><Group justify="space-between"><Text fw={600} size="sm">{focusedColumn.label}</Text><Button variant="subtle" size="compact-sm" onClick={() => setFocusField(null)}>{t("allFields")}</Button></Group><DetailValue value={datasetValue(detail.data, focusedColumn.path)} /></Stack> : fields.map(([key, value]) => <Box key={key} className={classes.field}><Text size="xs" c="dimmed" mb={6}>{key}</Text><DetailValue value={value} /></Box>)}
          </Tabs.Panel>
          <Tabs.Panel value="json" pt="md"><Code block className={classes.json}>{JSON.stringify(detail.data, null, 2)}</Code></Tabs.Panel>
        </Tabs>
      </Stack>}
    </Drawer>
  </>;
}
