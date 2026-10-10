"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Group, Modal, NativeSelect, Stack, Text } from "@mantine/core";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { importDataRecordsAction } from "@/features/data-library/server/actions";

export function DataImportDialog({ recordIds, labels, onComplete }: {
  recordIds: string[];
  labels: { importSelected: string; previewTitle: string; selectedCount: string; target: string; companies: string; contacts: string; duplicatePolicy: string; skipExisting: string; updateExisting: string; runImport: string; cancel: string; imported: string; updated: string; skipped: string; failed: string };
  onComplete: () => void;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [target, setTarget] = useState("company");
  const [policy, setPolicy] = useState("skip");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function run() {
    const form = new FormData();
    form.set("record_ids", JSON.stringify(recordIds));
    form.set("target", target);
    form.set("duplicate_policy", policy);
    startTransition(async () => {
      setError(""); setMessage("");
      const result = await importDataRecordsAction(form);
      if (result.error) return setError(result.error);
      const counts = result.counts;
      if (!counts) return setError("Import completed without a result summary.");
      setMessage(`${labels.imported}: ${counts.imported} · ${labels.updated}: ${counts.updated} · ${labels.skipped}: ${counts.skipped} · ${labels.failed}: ${counts.failed}`);
      onComplete();
      router.refresh();
    });
  }
  return <>
    <Button leftSection={<Download size={15} />} disabled={!recordIds.length} onClick={() => { setOpened(true); setMessage(""); setError(""); }}>{labels.importSelected}</Button>
    <Modal opened={opened} onClose={() => setOpened(false)} title={labels.previewTitle} centered>
      <Stack>
        <Text size="sm">{labels.selectedCount}: {recordIds.length}</Text>
        <NativeSelect label={labels.target} value={target} onChange={(event) => setTarget(event.currentTarget.value)} data={[{ value: "company", label: labels.companies }, { value: "contact", label: labels.contacts }]} />
        <NativeSelect label={labels.duplicatePolicy} value={policy} onChange={(event) => setPolicy(event.currentTarget.value)} data={[{ value: "skip", label: labels.skipExisting }, { value: "update", label: labels.updateExisting }]} />
        {error ? <Alert color="red">{error}</Alert> : null}
        {message ? <Alert color="teal">{message}</Alert> : null}
        <Group justify="flex-end"><Button variant="default" onClick={() => setOpened(false)}>{labels.cancel}</Button><Button loading={pending} disabled={!recordIds.length || Boolean(message)} onClick={run}>{labels.runImport}</Button></Group>
      </Stack>
    </Modal>
  </>;
}
