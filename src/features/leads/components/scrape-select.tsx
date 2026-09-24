"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@mantine/core";
import { toggleScrapeSelectionAction } from "@/features/leads/server/scrape-actions";

export function ScrapeSelectCheckbox({
  resultId,
  personId,
  selected,
  label,
  ariaLabel,
  locked = false,
}: {
  resultId?: string;
  personId?: string;
  selected: boolean;
  label?: string;
  ariaLabel?: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = override ?? selected;

  useEffect(() => {
    setOverride(null);
  }, [selected]);

  return (
    <Checkbox
      size="sm"
      checked={shown}
      disabled={pending || locked}
      label={label}
      aria-label={label ? undefined : ariaLabel}
      styles={{ label: { fontSize: 13, lineHeight: "18px", cursor: "pointer" }, input: { cursor: "pointer" } }}
      onChange={() => {
        if (locked) return;
        const next = !shown;
        setOverride(next);
        const data = new FormData();
        if (resultId) data.set("result_id", resultId);
        if (personId) data.set("person_id", personId);
        data.set("selected", next ? "true" : "false");
        startTransition(async () => {
          const result = await toggleScrapeSelectionAction(data);
          if ("error" in result && result.error) setOverride(null);
          else router.refresh();
        });
      }}
    />
  );
}
