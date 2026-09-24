"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Checkbox, Drawer, Group, NativeSelect, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { moveDealStageAction, updateDealAction } from "@/features/deals/server/actions";
import { completeTaskAction } from "@/features/tasks/server/actions";

export function StageMoveForm({
  dealId,
  stages,
  currentStageId,
}: {
  dealId: string;
  stages: { id: string; name: string; stageType: string }[];
  currentStageId: string;
}) {
  const [stageId, setStageId] = useState(currentStageId);
  const selected = stages.find((stage) => stage.id === stageId);
  const isLost = selected?.stageType === "lost";

  return (
    <ActionForm action={moveDealStageAction} submitLabel="Move stage">
      <input type="hidden" name="deal_id" value={dealId} />
      <NativeSelect
        name="stage_id"
        label="Stage"
        value={stageId}
        onChange={(event) => setStageId(event.currentTarget.value)}
        data={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
      />
      {isLost ? <TextInput name="lost_reason" label="Lost reason" /> : null}
    </ActionForm>
  );
}

export function DealEditButton({
  deal,
}: {
  deal: {
    id: string;
    updatedAt: string;
    title: string;
    amount: number;
    dealType: string;
    priority: string;
    expectedCloseDate: string;
    description: string;
    types: { value: string; label: string }[];
    priorities: { value: string; label: string }[];
  };
}) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button variant="subtle" size="compact-sm" onClick={() => setOpened(true)}>
        Edit
      </Button>
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Edit deal" position="right" size="md">
        <ActionForm
          key={`${deal.updatedAt}|${deal.title}|${deal.amount}|${deal.dealType}|${deal.priority}|${deal.expectedCloseDate}|${deal.description}`}
          action={updateDealAction}
          submitLabel="Save deal"
          onSuccess={() => setOpened(false)}
        >
          <input type="hidden" name="id" value={deal.id} />
          <TextInput name="title" label="Title" defaultValue={deal.title} required />
          <TextInput name="amount" type="number" label="Amount" defaultValue={String(deal.amount)} />
          <NativeSelect name="deal_type" label="Type" defaultValue={deal.dealType} data={deal.types} />
          <NativeSelect name="priority" label="Priority" defaultValue={deal.priority} data={deal.priorities} />
          <TextInput name="expected_close_date" type="date" label="Close date" defaultValue={deal.expectedCloseDate} />
          <Textarea name="description" label="Description" defaultValue={deal.description} minRows={3} />
        </ActionForm>
      </Drawer>
    </>
  );
}

export function DealTaskList({
  tasks,
}: {
  tasks: { id: string; title: string; status: string; dueAt: string | null }[];
}) {
  const [pendingId, setPendingId] = useState("");
  const [, startTransition] = useTransition();
  const ordered = [...tasks].sort((a, b) => taskRank(a.status) - taskRank(b.status));

  if (!ordered.length) {
    return (
      <Text size="sm" c="dimmed">
        Chưa có task.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {ordered.map((task) => {
        const done = task.status === "completed";
        return (
          <Group key={task.id} justify="space-between" wrap="nowrap" gap="sm">
            <Checkbox
              checked={done}
              disabled={Boolean(pendingId) || done || task.status === "canceled"}
              aria-label={`Complete ${task.title}`}
              onChange={() => {
                setPendingId(task.id);
                startTransition(async () => {
                  const form = new FormData();
                  form.set("id", task.id);
                  form.set("status", "completed");
                  await completeTaskAction(form);
                  setPendingId("");
                });
              }}
            />
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} lineClamp={1} c={done ? "dimmed" : undefined} td={done ? "line-through" : undefined}>
                {task.title}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {task.dueAt ? formatDue(task.dueAt) : "No due date"}
              </Text>
            </Stack>
            <Badge variant="light" color={done ? "gray" : "blue"}>
              {labelize(task.status)}
            </Badge>
          </Group>
        );
      })}
    </Stack>
  );
}

function taskRank(status: string) {
  if (status === "open") return 0;
  if (status === "completed") return 1;
  return 2;
}

function labelize(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

function formatDue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
