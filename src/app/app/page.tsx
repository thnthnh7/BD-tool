import { BriefcaseBusiness, CalendarDays, UserPlus, Wallet } from "lucide-react";
import { Grid, GridCol, SimpleGrid, Stack } from "@mantine/core";
import { MetricCard } from "@/components/leadely/metric-card";
import { DashboardHeader } from "@/components/leadely/dashboard/dashboard-header";
import { PipelineOverview } from "@/components/leadely/dashboard/pipeline-overview";
import { AiAssistantPanel } from "@/components/leadely/dashboard/ai-assistant-panel";
import { TodayTasksPanel } from "@/components/leadely/dashboard/today-tasks-panel";
import { RecentLeadsPanel } from "@/components/leadely/dashboard/recent-leads-panel";
import { DealForecastPanel } from "@/components/leadely/dashboard/deal-forecast-panel";
import { TopCompaniesPanel } from "@/components/leadely/dashboard/top-companies-panel";
import { LeadelyBanner } from "@/components/leadely/dashboard/leadely-banner";
import { loadWorkspaceAppData } from "@/lib/db/actions";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import { listCompanies } from "@/features/companies/server/actions";
import { listDeals, listPipelines } from "@/features/deals/server/actions";
import { listLeads } from "@/features/leads/server/actions";
import { listTasks } from "@/features/tasks/server/actions";
import { listMeetings, listNotifications } from "@/features/comms/server/actions";
import type { DashboardCompanyRank, DashboardDealPoint, DashboardLead, DashboardStage } from "@/components/leadely/dashboard/types";
import classes from "@/styles/leadely-dashboard.module.css";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function isOpenDeal(stageType: string | null | undefined) {
  return stageType !== "won" && stageType !== "lost";
}

export default async function AppHomePage() {
  const [{ context, quotes, clients }, deals, pipelinesData, leads, tasks, companies, meetings, notifications] = await Promise.all([
    loadWorkspaceAppData(["quotes", "clients"]),
    listDeals(),
    listPipelines(),
    listLeads(),
    listTasks(),
    listCompanies(),
    listMeetings(),
    listNotifications(),
  ]);

  const name = context.email.split("@")[0];
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const openDeals = deals.filter((deal) => isOpenDeal(deal.pipeline_stages?.stage_type));
  const wonDeals = deals.filter((deal) => deal.pipeline_stages?.stage_type === "won");
  const revenue = wonDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const weightedForecast = openDeals.reduce((sum, deal) => {
    const probability = deal.pipeline_stages?.probability ?? deal.probability ?? 0;
    return sum + Number(deal.amount || 0) * (Number(probability) / 100);
  }, 0);

  const openTasks = tasks.filter((task) => task.status === "open");
  const tasksToday = openTasks.filter((task) => task.due_at && new Date(task.due_at) >= todayStart && new Date(task.due_at) < todayEnd);
  const meetingsToday = meetings.filter((meeting) => {
    const startsAt = meeting.starts_at;
    if (!startsAt) return false;
    const date = new Date(startsAt);
    return date >= todayStart && date < todayEnd;
  }).length;

  const defaultPipeline = pipelinesData.pipelines.find((pipeline) => pipeline.is_default) || pipelinesData.pipelines[0];
  const crmStages: DashboardStage[] = pipelinesData.stages
    .filter((stage) => !defaultPipeline || stage.pipeline_id === defaultPipeline.id)
    .sort((a, b) => a.position - b.position)
    .map((stage) => ({ id: stage.id, name: stage.name, position: stage.position }));

  const dealPoints: DashboardDealPoint[] = deals.map((deal) => ({
    stageId: deal.stage_id,
    companyId: deal.company_id,
    companyName: deal.companies?.name || "Unnamed company",
    amount: Number(deal.amount || 0),
    probability: Number(deal.pipeline_stages?.probability ?? deal.probability ?? 0),
    date: deal.expected_close_date || deal.created_at,
  }));

  const quoteStages: DashboardStage[] = [
    { id: "draft", name: "Draft", position: 1 },
    { id: "sent", name: "Sent", position: 2 },
    { id: "won", name: "Won", position: 3 },
    { id: "lost", name: "Lost", position: 4 },
  ];
  const quotePoints: DashboardDealPoint[] = quotes.map((quote) => ({
    stageId: quote.status,
    companyId: quote.clientId || "",
    companyName: clients.find((client) => client.id === quote.clientId)?.companyName || "Untitled",
    amount: calculateQuoteTotals(quote).grandTotal,
    probability: quote.status === "won" ? 100 : quote.status === "sent" ? 50 : quote.status === "draft" ? 10 : 0,
    date: quote.createdAt,
  }));

  const pipelineStages = crmStages.length ? crmStages : quoteStages;
  const pipelineDeals = crmStages.length ? dealPoints : quotePoints;
  const forecastDeals = dealPoints.length ? dealPoints : quotePoints;

  const companyRanks: DashboardCompanyRank[] = Object.values(
    openDeals.reduce<Record<string, DashboardCompanyRank>>((acc, deal) => {
      const id = deal.company_id;
      const current = acc[id] || {
        id,
        name: deal.companies?.name || companies.find((company) => company.id === id)?.name || "Unnamed company",
        logo: deal.companies?.logo_path || companies.find((company) => company.id === id)?.logo_path || "",
        deals: 0,
        value: 0,
      };
      current.deals += 1;
      current.value += Number(deal.amount || 0);
      acc[id] = current;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value || b.deals - a.deals);

  const mappedLeads: DashboardLead[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.contacts?.display_name || lead.companies?.name || "Untitled lead",
    email: lead.contacts?.email || null,
    company: lead.companies?.name || null,
    companyLogo: lead.companies?.logo_path || null,
    companyId: lead.company_id,
    source: lead.source,
    status: lead.status,
    lastActivityAt: lead.last_activity_at || lead.updated_at,
    href: `/app/leads/${lead.id}`,
  }));
  const mappedQuotes: DashboardLead[] = quotes.slice(0, 6).map((quote) => ({
    id: quote.id,
    name: quote.title || "Untitled quote",
    email: quote.publicId,
    company: clients.find((client) => client.id === quote.clientId)?.companyName || null,
    companyLogo: clients.find((client) => client.id === quote.clientId)?.logoUrl || null,
    companyId: null,
    source: "quote",
    status: quote.status,
    lastActivityAt: quote.createdAt,
    href: `/app/quotes/${quote.id}`,
  }));
  const recentRows = mappedLeads.length ? mappedLeads : mappedQuotes;
  const recentTitle = mappedLeads.length ? "Recent Leads" : mappedQuotes.length ? "Recent Quotes" : "Recent Leads";

  return (
    <Stack gap={16}>
      <DashboardHeader
        greeting={`${greeting()}, ${name}`}
        subtitle="Here's your business development snapshot for today."
        notifications={notifications.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          readAt: item.read_at,
          createdAt: item.created_at,
        }))}
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing={16}>
        <MetricCard label="Total leads" value={String(leads.length)} icon={<UserPlus size={18} />} hint={`${leads.filter((lead) => lead.status === "working").length} working`} />
        <MetricCard label="Active deals" value={String(openDeals.length)} icon={<BriefcaseBusiness size={18} />} hint={formatVnd(weightedForecast)} />
        <MetricCard label="Meetings booked" value={String(meetings.length)} icon={<CalendarDays size={18} />} hint={`${meetingsToday} today`} />
        <MetricCard label="Revenue" value={formatVnd(revenue)} icon={<Wallet size={18} />} hint={`${wonDeals.length} won deals`} />
      </SimpleGrid>

      <Grid gap={16} align="stretch">
        <GridCol span={{ base: 12, md: 5 }} className={classes.rowFill}>
          <PipelineOverview stages={pipelineStages} deals={pipelineDeals} />
        </GridCol>
        <GridCol span={{ base: 12, md: 4 }} className={classes.rowFill}>
          <AiAssistantPanel />
        </GridCol>
        <GridCol span={{ base: 12, md: 3 }} className={classes.rowFill}>
          <TodayTasksPanel
            tasks={tasksToday.map((task) => ({
              id: task.id,
              title: task.title,
              dueAt: task.due_at,
              type: task.type,
            }))}
          />
        </GridCol>
      </Grid>

      <Grid gap={16} align="stretch">
        <GridCol span={{ base: 12, md: 5 }} className={classes.rowFill}>
          <RecentLeadsPanel leads={recentRows} title={recentTitle} />
        </GridCol>
        <GridCol span={{ base: 12, md: 4 }} className={classes.rowFill}>
          <DealForecastPanel deals={forecastDeals} />
        </GridCol>
        <GridCol span={{ base: 12, md: 3 }} className={classes.rowFill}>
          <TopCompaniesPanel companies={companyRanks} />
        </GridCol>
      </Grid>

      <LeadelyBanner />
    </Stack>
  );
}
