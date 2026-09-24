"use client";

import { useMemo, useState } from "react";
import { Group, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { LinkButton } from "@/components/mantine-link";

const SCROLL_FROM = 6;

type PickerSource = {
  id: string;
  title: string;
  ready: boolean;
};

function sourceHref(id: string, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("source", id);
  return `/app/leads/scrape?${params.toString()}`;
}

function statusText(ready: boolean) {
  return ready ? "Chạy được" : "Chưa chạy";
}

function SourceRow({ source, selected, query }: { source: PickerSource; selected: boolean; query: string }) {
  return (
    <LinkButton
      href={sourceHref(source.id, query)}
      fullWidth
      justify="flex-start"
      variant={selected ? "light" : "subtle"}
      color={selected ? "leadely" : "gray"}
      aria-current={selected ? "true" : undefined}
      styles={{ label: { width: "100%", overflow: "hidden" } }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm" w="100%">
        <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }}>
          {source.title}
        </Text>
        <Text size="xs" c={source.ready ? "teal" : "dimmed"} style={{ flexShrink: 0 }}>
          {statusText(source.ready)}
        </Text>
      </Group>
    </LinkButton>
  );
}

export function InstalledSourcePicker({
  sources,
  selectedId,
  query,
}: {
  sources: PickerSource[];
  selectedId: string;
  query: string;
}) {
  const [filter, setFilter] = useState("");
  const scroll = sources.length >= SCROLL_FROM;
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return sources;
    return sources.filter((source) => source.title.toLowerCase().includes(needle));
  }, [filter, sources]);

  const rows = visible.length ? (
    visible.map((source) => <SourceRow key={source.id} source={source} selected={source.id === selectedId} query={query} />)
  ) : (
    <Text size="sm" c="dimmed">
      Không có nguồn khớp.
    </Text>
  );

  return (
    <Stack gap="xs">
      {scroll ? (
        <TextInput
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
          placeholder="Tìm trong nguồn đã cài"
          aria-label="Tìm trong nguồn đã cài"
        />
      ) : null}
      {scroll ? (
        <ScrollArea h={220} type="auto" offsetScrollbars>
          <Stack gap={4}>{rows}</Stack>
        </ScrollArea>
      ) : (
        <Stack gap={4}>{rows}</Stack>
      )}
    </Stack>
  );
}
