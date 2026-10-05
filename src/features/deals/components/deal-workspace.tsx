"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Badge, Button, Checkbox, Drawer, Group, NativeSelect, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { moveDealStageAction, updateDealAction } from "@/features/deals/server/actions";
import { completeTaskAction } from "@/features/tasks/server/actions";
import { DEAL_CURRENCIES } from "@/lib/money";

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
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = stages.find((stage) => stage.id === stageId);
  const isLost = selected?.stageType === "lost";

  function move(nextStageId: string, lostReason = "") {
    setError("");
    startTransition(async () => {
      const form = new FormData();
      form.set("deal_id", dealId);
      form.set("stage_id", nextStageId);
      if (lostReason) form.set("lost_reason", lostReason);
      const result = await moveDealStageAction(form);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Stack gap={4}>
      <NativeSelect
        label="Stage"
        value={stageId}
        disabled={pending}
        onChange={(event) => {
          const nextStageId = event.currentTarget.value;
          setStageId(nextStageId);
          const nextStage = stages.find((stage) => stage.id === nextStageId);
          if (nextStage?.stageType !== "lost") move(nextStageId);
        }}
        data={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
      />
      {isLost ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            move(stageId, String(form.get("lost_reason") || ""));
          }}
        >
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput name="lost_reason" label="Lost reason" required style={{ flex: 1 }} />
            <Button type="submit" loading={pending} size="sm">Confirm</Button>
          </Group>
        </form>
      ) : null}
      {error ? <Text size="xs" c="red">{error}</Text> : null}
    </Stack>
  );
}

export function CompactDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <Stack gap="sm">
      <Button variant="subtle" size="compact-sm" w="fit-content" onClick={() => setOpened((value) => !value)}>
        {opened ? "Cancel" : label}
      </Button>
      {opened ? children : null}
    </Stack>
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
    currency: string;
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
          key={`${deal.updatedAt}|${deal.title}|${deal.amount}|${deal.currency}|${deal.dealType}|${deal.priority}|${deal.expectedCloseDate}|${deal.description}`}
          action={updateDealAction}
          submitLabel="Save deal"
          onSuccess={() => setOpened(false)}
        >
          <input type="hidden" name="id" value={deal.id} />
          <TextInput name="title" label="Title" defaultValue={deal.title} required />
          <Group grow align="flex-start">
            <TextInput name="amount" type="number" label="Amount" defaultValue={String(deal.amount)} min={0} />
            <NativeSelect name="currency" label="Currency" defaultValue={deal.currency} data={DEAL_CURRENCIES.map((item) => ({ value: item, label: item }))} />
          </Group>
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
        const canceled = task.status === "canceled";
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
            {canceled ? <Badge variant="light" color="gray">Canceled</Badge> : null}
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
