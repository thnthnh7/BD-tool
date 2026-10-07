"use client";

import { ActionIcon, Divider, NativeSelect, Popover, Stack, TextInput } from "@mantine/core";
import { Pencil } from "lucide-react";
import { ContractFiles } from "@/features/deals/components/contract-files";
import { ActionForm } from "@/features/crm/components/action-form";
import { updateContractAction } from "@/features/deals/server/intel";
import type { Client, CompanySettings, Quote } from "@/lib/types";

const STATUSES = ["draft", "sent", "signed", "void"].map((item) => ({ value: item, label: item }));

export function ContractEditor({
  id,
  title,
  status,
  notes,
  docxName,
  settings,
  quote,
  client,
}: {
  id: string;
  title: string;
  status: string;
  notes: string;
  docxName: string | null;
  settings: CompanySettings;
  quote: Quote | null;
  client: Client | null;
}) {
  return (
    <Popover position="bottom-end" withArrow shadow="md" width={320} trapFocus>
      <Popover.Target>
        <ActionIcon variant="subtle" color="gray" size={32} aria-label={`Edit ${title}`} data-tutorial-id="contract-edit-trigger">
          <Pencil size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <div data-tutorial-id="contract-editor">
        <Stack gap="sm">
          <ActionForm action={updateContractAction} submitLabel="Save">
            <Stack gap="sm">
              <input type="hidden" name="id" value={id} />
              <TextInput name="title" label="Title" defaultValue={title} />
              <NativeSelect name="status" label="Status" defaultValue={status} data={STATUSES} />
              <TextInput name="notes" label="Notes" defaultValue={notes} />
            </Stack>
          </ActionForm>
          <Divider />
          <ContractFiles contractId={id} docxName={docxName} settings={settings} quote={quote} client={client} />
        </Stack>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
