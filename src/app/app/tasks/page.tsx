import { Badge, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Search, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/mantine-link";
import { ListFooter } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { listDeals } from "@/features/deals/server/actions";
import { TaskCreateDrawer } from "@/features/tasks/components/task-create-drawer";
import { TaskDayList, type TaskDayRow } from "@/features/tasks/components/task-day-list";
import { listTasks } from "@/features/tasks/server/actions";
import { DEAL_PRIORITIES, TASK_TYPES } from "@/lib/crm";
import { matchesQuery, slicePage } from "@/lib/list-page";
import { getLocale, getTranslations } from "next-intl/server";

type TaskView = "open" | "completed" | "canceled";
type Params = { q?: string; page?: string; view?: string; type?: string; priority?: string };

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("Tasks"), getLocale()]);
  const q = (params.q || "").trim();
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const view: TaskView = params.view === "completed" || params.view === "canceled" ? params.view : "open";
  const type = TASK_TYPES.includes(params.type as (typeof TASK_TYPES)[number]) ? params.type || "" : "";
  const priority = DEAL_PRIORITIES.includes(params.priority as (typeof DEAL_PRIORITIES)[number]) ? params.priority || "" : "";
  const [tasks, companies, contacts, deals] = await Promise.all([listTasks(), listCompanies(), listContacts(), listDeals()]);
  const { start, end } = dayBounds();
  const open = tasks.filter((task) => task.status === "open");
  const counts = {
    overdue: open.filter((task) => task.due_at && new Date(task.due_at) < start).length,
    today: open.filter((task) => task.due_at && new Date(task.due_at) >= start && new Date(task.due_at) < end).length,
    upcoming: open.filter((task) => task.due_at && new Date(task.due_at) >= end).length,
    unscheduled: open.filter((task) => !task.due_at).length,
    completed: tasks.filter((task) => task.status === "completed").length,
    canceled: tasks.filter((task) => task.status === "canceled").length,
  };
  const filtered = tasks.filter((task) => {
    if (task.status !== view || (type && task.type !== type) || (priority && task.priority !== priority)) return false;
    return matchesQuery(q, [task.title, task.type, task.description, task.deals?.title, task.companies?.name, task.contacts?.display_name]);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
  const paged = slicePage(sorted, page, 50);
  const groups = view === "open" ? [
    { title: t("overdue"), empty: t("emptyOverdue"), due: "datetime" as const, tone: "danger" as const, tasks: paged.rows.filter((task) => task.due_at && new Date(task.due_at) < start) },
    { title: t("today"), empty: t("emptyToday"), due: "time" as const, tasks: paged.rows.filter((task) => task.due_at && new Date(task.due_at) >= start && new Date(task.due_at) < end) },
    { title: t("upcoming"), empty: t("emptyUpcoming"), due: "datetime" as const, tasks: paged.rows.filter((task) => task.due_at && new Date(task.due_at) >= end) },
    { title: t("unscheduled"), empty: t("emptyUnscheduled"), due: "datetime" as const, tasks: paged.rows.filter((task) => !task.due_at) },
  ] : [{ title: t(view), empty: t(view === "completed" ? "emptyCompleted" : "emptyCanceled"), due: "datetime" as const, tasks: paged.rows }];
  const toRow = (task: (typeof tasks)[number]): TaskDayRow => ({
    id: task.id, title: task.title, subtitle: task.deals?.title || task.companies?.name || "",
    context: [task.companies?.name, task.deals?.title, task.contacts?.display_name].filter((item): item is string => Boolean(item)),
    dueAt: task.due_at, status: task.status, type: task.type, priority: task.priority,
  });
  const sections = groups.map((group) => ({ ...group, tasks: group.tasks.map(toRow) }));
  const extras = { view: view === "open" ? "" : view, type, priority };

  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle", { date: new Date().toLocaleDateString(locale) })} action={
      <TaskCreateDrawer companies={companies.map((item) => ({ value: item.id, label: item.name }))} contacts={contacts.map((item) => ({ value: item.id, label: item.display_name }))} deals={deals.map((item) => ({ value: item.id, label: item.title }))} />
    } />
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      <SummaryCard label={t("overdue")} value={counts.overdue} color="red" icon={<AlertTriangle size={18} />} />
      <SummaryCard label={t("today")} value={counts.today} color="blue" icon={<CalendarDays size={18} />} />
      <SummaryCard label={t("upcoming")} value={counts.upcoming} color="teal" icon={<Clock3 size={18} />} />
      <SummaryCard label={t("unscheduled")} value={counts.unscheduled} color="gray" icon={<Clock3 size={18} />} />
    </SimpleGrid>
    <SectionPanel padded={false}>
      <Stack gap={0}>
        <Group px="md" pt="md" gap="xs" wrap="wrap">
          <ViewLink active={view === "open"} href={taskHref({ view: "open", q, type, priority })} label={t("todo")} count={open.length} icon={<Clock3 size={15} />} />
          <ViewLink active={view === "completed"} href={taskHref({ view: "completed", q, type, priority })} label={t("completed")} count={counts.completed} icon={<CheckCircle2 size={15} />} />
          <ViewLink active={view === "canceled"} href={taskHref({ view: "canceled", q, type, priority })} label={t("canceled")} count={counts.canceled} icon={<XCircle size={15} />} />
        </Group>
        <form action="/app/tasks">
          <input type="hidden" name="view" value={view} />
          <Group px="md" py="md" gap="sm" align="flex-end" wrap="wrap" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <TextInput name="q" defaultValue={q} label={t("search")} placeholder={t("searchPlaceholder")} leftSection={<Search size={15} />} style={{ flex: "1 1 280px" }} />
            <NativeSelect name="type" defaultValue={type} label={t("type")} data={[{ value: "", label: t("allTypes") }, ...TASK_TYPES.map((item) => ({ value: item, label: t(item) }))]} w={170} />
            <NativeSelect name="priority" defaultValue={priority} label={t("priority")} data={[{ value: "", label: t("allPriorities") }, ...DEAL_PRIORITIES.map((item) => ({ value: item, label: t(item) }))]} w={160} />
            <Button type="submit" variant="light">{t("filter")}</Button>
            {q || type || priority ? <LinkButton href={taskHref({ view })} variant="subtle" color="gray">{t("clearFilters")}</LinkButton> : null}
          </Group>
        </form>
        <Stack p="md" gap="sm">
          {paged.total === 0 ? <Text size="sm" c="dimmed" py="xl" ta="center">{t("noMatches")}</Text> : <TaskDayList sections={sections} />}
        </Stack>
        {paged.total ? <ListFooter path="/app/tasks" q={q} {...paged} singular={t("item")} plural={t("items")} extra={extras} ofLabel={locale === "vi" ? "của" : "of"} /> : null}
      </Stack>
    </SectionPanel>
  </Stack>;
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: ReactNode }) {
  return <Paper withBorder radius="md" p="md"><Group justify="space-between"><Stack gap={2}><Text size="xs" c="dimmed" fw={600}>{label}</Text><Text size="xl" fw={700}>{value}</Text></Stack><Badge color={color} variant="light" size="lg" circle>{icon}</Badge></Group></Paper>;
}

function ViewLink({ active, href, label, count, icon }: { active: boolean; href: string; label: string; count: number; icon: ReactNode }) {
  return <LinkButton href={href} variant={active ? "filled" : "subtle"} color={active ? "leadely" : "gray"} leftSection={icon}>{label}<Badge ml={6} size="sm" variant={active ? "white" : "light"} color={active ? "leadely" : "gray"}>{count}</Badge></LinkButton>;
}

function taskHref(values: { view?: TaskView; q?: string; type?: string; priority?: string }) {
  const params = new URLSearchParams();
  if (values.view && values.view !== "open") params.set("view", values.view);
  if (values.q) params.set("q", values.q);
  if (values.type) params.set("type", values.type);
  if (values.priority) params.set("priority", values.priority);
  return params.size ? `/app/tasks?${params.toString()}` : "/app/tasks";
}
