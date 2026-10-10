"use client";

import { Badge, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Clock3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ActionForm } from "@/features/crm/components/action-form";
import { completeTaskAction, createTaskAction } from "@/features/tasks/server/actions";
import { DEAL_PRIORITIES, TASK_TYPES } from "@/lib/crm";

type EntityTask = { id: string; title: string; type: string; priority: string; status: string; due_at: string | null };

export function EntityTaskPanel({ tasks, companyId, contactId }: {
  tasks: EntityTask[];
  companyId?: string;
  contactId?: string;
}) {
  const t = useTranslations("Tasks");
  const locale = useLocale();
  return <Stack gap="md">
    <Group justify="space-between">
      <div><Text fw={650}>{t("nextActions")}</Text><Text size="xs" c="dimmed">{t("nextActionsDescription")}</Text></div>
      <Badge variant="light" color={tasks.length ? "teal" : "gray"}>{tasks.length}</Badge>
    </Group>
    {tasks.length ? <Stack gap="xs">
      {tasks.map((task) => <Group key={task.id} justify="space-between" wrap="nowrap" p="sm" style={{ border: "1px solid var(--mantine-color-gray-2)", borderRadius: "var(--mantine-radius-md)" }}>
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Clock3 size={16} />
          <div style={{ minWidth: 0 }}><Text size="sm" fw={600} lineClamp={1}>{task.title}</Text><Text size="xs" c="dimmed">{t(task.type)} · {t(task.priority)} · {task.due_at ? new Date(task.due_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("noDue")}</Text></div>
        </Group>
        <ActionForm action={completeTaskAction} submitLabel={t("completeAction")} layout="inline" variant="light">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value="completed" />
        </ActionForm>
      </Group>)}
    </Stack> : <Text size="sm" c="dimmed">{t("emptyEntity")}</Text>}
    <ActionForm action={createTaskAction} submitLabel={t("addAction")} layout="inline">
      {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
      {contactId ? <input type="hidden" name="contact_id" value={contactId} /> : null}
      <TextInput name="title" label={t("taskTitle")} placeholder={t("titlePlaceholder")} required style={{ flex: "1 1 220px" }} />
      <SimpleGrid cols={3} spacing="xs" style={{ flex: "1 1 380px" }}>
        <NativeSelect name="type" label={t("taskType")} data={TASK_TYPES.map((item) => ({ value: item, label: t(item) }))} />
        <NativeSelect name="priority" label={t("priority")} defaultValue="medium" data={DEAL_PRIORITIES.map((item) => ({ value: item, label: t(item) }))} />
        <TextInput name="due_at" type="datetime-local" label={t("due")} />
      </SimpleGrid>
    </ActionForm>
  </Stack>;
}
