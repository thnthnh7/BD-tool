"use client";

import { useTransition } from "react";
import { ActionIcon, Checkbox, Group, Text } from "@mantine/core";
import { CheckSquare, Mail, Phone, CalendarDays, FileText, Eye, MoreHorizontal } from "lucide-react";
import { completeTaskAction } from "@/features/tasks/server/actions";
import { DashboardPanel } from "./dashboard-panel";
import { CompactEmpty } from "./compact-empty";
import { formatDueTime } from "./period";
import type { DashboardTask } from "./types";
import classes from "@/styles/leadely-dashboard.module.css";

const TYPE_ICON = {
  follow_up: MoreHorizontal,
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  proposal: FileText,
  review: Eye,
  other: CheckSquare,
} as const;

export function TodayTasksPanel({ tasks }: { tasks: DashboardTask[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <DashboardPanel title="Today's Tasks" minHeight={320} className={classes.rowPanel}>
      {tasks.length === 0 ? (
        <CompactEmpty icon={<CheckSquare size={14} />} title="Nothing due today" description="Open tasks will land here when they are due." href="/app/tasks" actionLabel="View tasks" />
      ) : (
        <div>
          {tasks.slice(0, 6).map((task) => {
            const Icon = TYPE_ICON[task.type as keyof typeof TYPE_ICON] || CheckSquare;
            return (
              <Group key={task.id} className={classes.taskRow} wrap="nowrap" gap="sm" justify="space-between">
                <Checkbox
                  disabled={pending}
                  aria-label={`Complete ${task.title}`}
                  onChange={() => {
                    startTransition(async () => {
                      const form = new FormData();
                      form.set("id", task.id);
                      form.set("status", "completed");
                      await completeTaskAction(form);
                    });
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {task.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDueTime(task.dueAt)}
                  </Text>
                </div>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-hidden>
                  <Icon size={14} />
                </ActionIcon>
              </Group>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
