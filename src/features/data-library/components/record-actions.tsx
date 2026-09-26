"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Group, Text } from "@mantine/core";
import { Building2, UserPlus } from "lucide-react";
import { promoteDataRecordAction } from "@/features/data-library/server/actions";

export function DataRecordActions({ recordId, companyId, contactId, companyLabel, contactLabel, savedLabel, allowCompany, allowContact }: {
  recordId: string; companyId: string | null; contactId: string | null;
  companyLabel: string; contactLabel: string; savedLabel: string;
  allowCompany: boolean; allowContact: boolean;
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
  if (!allowCompany && !allowContact) return null;
  return <>
    <Group gap={6} wrap="wrap">
      {allowCompany ? <Button size="compact-xs" variant="subtle" leftSection={<Building2 size={12} />} disabled={Boolean(companyId)} loading={pending} onClick={() => promote("company")}>
        {companyId ? savedLabel : companyLabel}
      </Button> : null}
      {allowContact ? <Button size="compact-xs" variant="subtle" leftSection={<UserPlus size={12} />} disabled={Boolean(contactId)} loading={pending} onClick={() => promote("contact")}>
        {contactId ? savedLabel : contactLabel}
      </Button> : null}
    </Group>
    {error ? <Text size="xs" c="red">{error}</Text> : null}
  </>;
}
