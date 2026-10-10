"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Group, Text } from "@mantine/core";
import { Ban, Building2, RotateCcw, UserPlus } from "lucide-react";
import { promoteDataRecordAction, setDataRecordSuppressionAction } from "@/features/data-library/server/actions";

export function DataRecordActions({ recordId, companyId, contactId, companyLabel, contactLabel, savedLabel, allowCompany, allowContact, reviewStatus, duplicateOfId, suppressLabel, restoreLabel }: {
  recordId: string; companyId: string | null; contactId: string | null;
  companyLabel: string; contactLabel: string; savedLabel: string;
  allowCompany: boolean; allowContact: boolean;
  reviewStatus: string; duplicateOfId: string | null; suppressLabel: string; restoreLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function promote(target: "company" | "contact") {
    const form = new FormData();
    form.set("record_id", recordId);
    form.set("target", target);
    startTransition(async () => {
      setError("");
      const result = await promoteDataRecordAction(form);
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }
  function toggleSuppression() {
    const form = new FormData();
    form.set("record_id", recordId);
    form.set("suppressed", String(reviewStatus !== "suppressed"));
    startTransition(async () => {
      setError("");
      const result = await setDataRecordSuppressionAction(form);
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }
  if (!allowCompany && !allowContact) return null;
  return <>
    <Group gap={6} wrap="wrap">
      {allowCompany ? <Button size="compact-xs" variant="subtle" leftSection={<Building2 size={12} />} disabled={Boolean(companyId) || reviewStatus === "suppressed" || Boolean(duplicateOfId)} loading={pending} onClick={() => promote("company")}>
        {companyId ? savedLabel : companyLabel}
      </Button> : null}
      {allowContact ? <Button size="compact-xs" variant="subtle" leftSection={<UserPlus size={12} />} disabled={Boolean(contactId) || reviewStatus === "suppressed" || Boolean(duplicateOfId)} loading={pending} onClick={() => promote("contact")}>
        {contactId ? savedLabel : contactLabel}
      </Button> : null}
      <Button size="compact-xs" variant="subtle" color={reviewStatus === "suppressed" ? "gray" : "red"} leftSection={reviewStatus === "suppressed" ? <RotateCcw size={12} /> : <Ban size={12} />} loading={pending} onClick={toggleSuppression}>
        {reviewStatus === "suppressed" ? restoreLabel : suppressLabel}
      </Button>
    </Group>
    {error ? <Text size="xs" c="red">{error}</Text> : null}
  </>;
}
