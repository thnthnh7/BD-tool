"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { ScrapeSelectCheckbox } from "@/features/leads/components/scrape-select";
import { setScrapeBulkSelectionAction } from "@/features/leads/server/scrape-actions";
import { useTranslations } from "next-intl";

type BulkTarget = "places" | "people";

function useBulkSelection(jobId: string, query: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(target: BulkTarget, selected: boolean) {
    const data = new FormData();
    data.set("job_id", jobId);
    data.set("q", query);
    data.set("target", target);
    data.set("selected", selected ? "true" : "false");
    startTransition(async () => {
      setError("");
      const result = await setScrapeBulkSelectionAction(data);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return { pending, error, run };
}

export function ScrapeSelectionControls({
  jobId,
  query,
  eligiblePlaces,
  selectedPlaces,
}: {
  jobId: string;
  query: string;
  eligiblePlaces: number;
  selectedPlaces: number;
}) {
  const bulk = useBulkSelection(jobId, query);
  const t = useTranslations("Scrape");
  return (
    <Stack gap={4}>
      <Group gap="lg" wrap="wrap">
        <Group gap={6}>
          <Text size="sm" c="dimmed">
            {t("selectPlaces")}
          </Text>
          <Button variant="subtle" color="gray" h={28} px="xs" disabled={bulk.pending || eligiblePlaces === 0} onClick={() => bulk.run("places", true)}>
            {t("selectAll")}
          </Button>
          <Button variant="subtle" color="gray" h={28} px="xs" disabled={bulk.pending || selectedPlaces === 0} onClick={() => bulk.run("places", false)}>
            {t("selectNone")}
          </Button>
        </Group>
        <Group gap={6}>
          <Text size="sm" c="dimmed">
            {t("selectPeople")}
          </Text>
          <Button variant="subtle" color="gray" h={28} px="xs" disabled={bulk.pending || eligiblePlaces === 0} onClick={() => bulk.run("people", true)}>
            {t("selectAll")}
          </Button>
          <Button variant="subtle" color="gray" h={28} px="xs" disabled={bulk.pending || eligiblePlaces === 0} onClick={() => bulk.run("people", false)}>
            {t("selectNone")}
          </Button>
        </Group>
      </Group>
      {bulk.error ? (
        <Text size="sm" c="red">
          {bulk.error}
        </Text>
      ) : null}
    </Stack>
  );
}

export function ScrapeHeaderCheckbox({
  jobId,
  query,
  eligible,
  selected,
  target,
  label,
}: {
  jobId: string;
  query: string;
  eligible: number;
  selected: number;
  target: "places" | "people";
  label: string;
}) {
  const bulk = useBulkSelection(jobId, query);
  const all = eligible > 0 && selected === eligible;
  return (
    <Checkbox
      size="sm"
      checked={all}
      indeterminate={selected > 0 && !all}
      disabled={bulk.pending || eligible === 0}
      aria-label={label}
      onChange={() => bulk.run(target, !all)}
    />
  );
}

export function PlacePeople({
  people,
  locked,
}: {
  people: { id: string; name: string; label: string; selected: boolean }[];
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Scrape");
  if (!people.length) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  if (people.length === 1 || open) {
    return (
      <Stack gap={6}>
        {people.map((person) => (
          <ScrapeSelectCheckbox key={person.id} personId={person.id} selected={person.selected} label={person.label} locked={locked} />
        ))}
        {people.length > 1 ? (
          <Button variant="subtle" color="gray" h={24} px={0} w="fit-content" onClick={() => setOpen(false)}>
            {t("collapse")}
          </Button>
        ) : null}
      </Stack>
    );
  }
  return (
    <Button variant="subtle" color="gray" h={28} px={0} onClick={() => setOpen(true)}>
      {t("morePeople", { name: people[0].name, count: people.length - 1 })}
    </Button>
  );
}
