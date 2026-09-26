"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionIcon, Button, Group, Menu, Text } from "@mantine/core";
import { MoreHorizontal, Play, Plus, Trash2 } from "lucide-react";
import { installScrapeSourceAction, uninstallScrapeSourceAction } from "@/features/leads/server/source-actions";

export function SourceCardActions({
  sourceId,
  installed,
  canManage,
  installLabel,
  runLabel,
  removeLabel,
}: {
  sourceId: string;
  installed: boolean;
  canManage: boolean;
  installLabel: string;
  runLabel: string;
  removeLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function mutate(action: typeof installScrapeSourceAction) {
    const form = new FormData();
    form.set("source_id", sourceId);
    startTransition(async () => {
      setError("");
      const result = await action(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!installed) {
    return canManage ? (
      <Button
        size="compact-sm"
        variant="subtle"
        leftSection={<Plus size={14} />}
        loading={pending}
        onClick={() => mutate(installScrapeSourceAction)}
      >
        {installLabel}
      </Button>
    ) : null;
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Button
        component={Link}
        href={`/app/leads/scrape/new?source=${sourceId}`}
        size="compact-xs"
        variant="subtle"
        leftSection={<Play size={11} fill="currentColor" />}
        styles={{
          root: { paddingInline: 6 },
          section: { marginInlineEnd: 4 },
        }}
      >
        {runLabel}
      </Button>
      {canManage ? (
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size={28} aria-label={removeLabel} loading={pending}>
              <MoreHorizontal size={17} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => {
                if (window.confirm(`${removeLabel}?`)) mutate(uninstallScrapeSourceAction);
              }}
            >
              {removeLabel}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ) : null}
      {error ? <Text size="xs" c="red" className="sr-only">{error}</Text> : null}
    </Group>
  );
}
