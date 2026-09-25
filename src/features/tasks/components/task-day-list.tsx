"use client";

import { useState, useTransition } from "react";
import { Badge, Box, Checkbox, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { CalendarClock, Mail, Phone, Presentation, RefreshCw, SearchCheck, Users } from "lucide-react";
import { completeTaskAction } from "@/features/tasks/server/actions";
import { useLocale, useTranslations } from "next-intl";

export type TaskDayRow = {
  id: string;
  title: string;
  subtitle: string;
  context: string[];
  dueAt: string | null;
  status: string;
  type: string;
  priority: string;
};

export type TaskDaySection = {
  title: string;
  empty: string;
  due: "time" | "datetime";
  tone?: "default" | "danger";
  tasks: TaskDayRow[];
};

export function TaskDayList({ sections }: { sections: TaskDaySection[] }) {
  const t = useTranslations("Tasks");
  const locale = useLocale();
  const [pendingId, setPendingId] = useState("");
  const [, startTransition] = useTransition();
  return <Stack gap="sm">
    {sections.map((section) => <Paper key={section.title} withBorder radius="md" style={{ overflow: "hidden" }}>
      <Group justify="space-between" px="md" py="sm" bg={section.tone === "danger" ? "red.0" : "gray.0"}>
        <Text size="sm" fw={700} c={section.tone === "danger" ? "red.7" : undefined}>{section.title}</Text>
        <Badge variant="light" color={section.tone === "danger" ? "red" : "gray"}>{section.tasks.length}</Badge>
      </Group>
      {section.tasks.length ? <Stack gap={0}>
        {section.tasks.map((task) => {
          const done = task.status === "completed";
          const locked = task.status !== "open";
          return <Group key={task.id} wrap="nowrap" gap="sm" px="md" py="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
            <Checkbox checked={done} disabled={Boolean(pendingId) || locked} aria-label={t("complete", { title: task.title })} onChange={() => {
              setPendingId(task.id);
              startTransition(async () => {
                const form = new FormData();
                form.set("id", task.id);
                form.set("status", "completed");
                await completeTaskAction(form);
                setPendingId("");
              });
            }} />
            <ThemeIcon variant="light" color={taskColor(task.type)} size={34} radius="md" style={{ flexShrink: 0 }}>{taskIcon(task.type)}</ThemeIcon>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={600} lineClamp={1} c={locked ? "dimmed" : undefined} td={done ? "line-through" : undefined}>{task.title}</Text>
                <Badge size="xs" variant="light" color={priorityColor(task.priority)} style={{ flexShrink: 0 }}>{t(task.priority)}</Badge>
              </Group>
              {task.context.length ? <Text size="xs" c="dimmed" lineClamp={1}>{task.context.join(" · ")}</Text> : null}
            </Stack>
            <Box ta="right" style={{ flexShrink: 0 }}>
              <Text size="xs" fw={section.tone === "danger" ? 600 : 400} c={section.tone === "danger" ? "red" : "dimmed"}>{formatDue(task.dueAt, section.due, locale, t("noDue"))}</Text>
              <Text size="xs" c="dimmed">{t(task.type)}</Text>
            </Box>
          </Group>;
        })}
      </Stack> : <Text size="sm" c="dimmed" px="md" py="lg">{section.empty}</Text>}
    </Paper>)}
  </Stack>;
}

function taskIcon(type: string) {
  const props = { size: 16 };
  if (type === "call") return <Phone {...props} />;
  if (type === "email") return <Mail {...props} />;
  if (type === "meeting") return <Users {...props} />;
  if (type === "proposal") return <Presentation {...props} />;
  if (type === "review") return <SearchCheck {...props} />;
  if (type === "follow_up") return <RefreshCw {...props} />;
  return <CalendarClock {...props} />;
}
function taskColor(type: string) { return ({ call: "blue", email: "violet", meeting: "orange", proposal: "teal" } as Record<string, string>)[type] || "gray"; }
function priorityColor(priority: string) { return priority === "high" ? "red" : priority === "medium" ? "orange" : "gray"; }
function formatDue(value: string | null, mode: "time" | "datetime", locale: string, noDue: string) {
  if (!value) return noDue;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (mode === "time") return time;
  const day = date.toLocaleDateString(locale, { day: "numeric", month: "numeric" });
  return `${day} · ${time}`;
}
