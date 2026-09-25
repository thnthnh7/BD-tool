"use client";

import { useState } from "react";
import { Button, Drawer, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Plus } from "lucide-react";
import { ActionForm } from "@/features/crm/components/action-form";
import { createTaskAction } from "@/features/tasks/server/actions";
import { DEAL_PRIORITIES, TASK_TYPES } from "@/lib/crm";
import { useTranslations } from "next-intl";

type Option = { value: string; label: string };

export function TaskCreateDrawer({ companies, contacts, deals }: { companies: Option[]; contacts: Option[]; deals: Option[] }) {
  const t = useTranslations("Tasks");
  const [opened, setOpened] = useState(false);
  return <>
    <Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>{t("create")}</Button>
    <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size="lg" title={<Text fw={700}>{t("createTitle")}</Text>}>
      <ActionForm action={createTaskAction} submitLabel={t("create")} onSuccess={() => setOpened(false)}>
        <Stack gap="sm">
          <TextInput name="title" label={t("taskTitle")} placeholder={t("titlePlaceholder")} required />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect name="type" label={t("taskType")} data={TASK_TYPES.map((item) => ({ value: item, label: t(item) }))} />
            <NativeSelect name="priority" label={t("priority")} defaultValue="medium" data={DEAL_PRIORITIES.map((item) => ({ value: item, label: t(item) }))} />
            <TextInput name="due_at" type="datetime-local" label={t("due")} />
            <NativeSelect name="company_id" label={t("company")} data={[{ value: "", label: t("none") }, ...companies]} />
            <NativeSelect name="deal_id" label={t("deal")} data={[{ value: "", label: t("none") }, ...deals]} />
            <NativeSelect name="contact_id" label={t("contact")} data={[{ value: "", label: t("none") }, ...contacts]} />
          </SimpleGrid>
          <Textarea name="description" label={t("description")} minRows={4} autosize />
        </Stack>
      </ActionForm>
    </Drawer>
  </>;
}
