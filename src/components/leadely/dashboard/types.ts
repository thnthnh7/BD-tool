export type PeriodKey = "month" | "30d" | "quarter" | "all";

export type DashboardLead = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  companyLogo?: string | null;
  companyId: string | null;
  source: string;
  status: string;
  lastActivityAt: string | null;
  href: string;
};

export type DashboardTask = {
  id: string;
  title: string;
  dueAt: string | null;
  type: string;
};

export type DashboardStage = {
  id: string;
  name: string;
  position: number;
};

export type DashboardDealPoint = {
  stageId: string;
  companyId: string;
  companyName: string;
  amount: number;
  probability: number;
  date: string;
};

export type DashboardCompanyRank = {
  id: string;
  name: string;
  logo?: string;
  deals: number;
  value: number;
};

export type DashboardNotification = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SearchTarget = {
  label: string;
  href: string;
  keywords: string;
};
