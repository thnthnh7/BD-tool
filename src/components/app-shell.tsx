"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { Alert, AppShell, Avatar, Burger, Group, Menu, NavLink, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronUp,
  CreditCard,
  Database,
  FileText,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Share2,
  ListFilter,
  LogOut,
  Library,
  Mail,
  Network,
  Radar,
  PackagePlus,
  Plus,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { AppLogo } from "@/components/leadely/app-logo";
import { LinkButton } from "@/components/mantine-link";
import { ContentContainer } from "@/components/layout/content-container";
import { signOut } from "@/lib/auth/actions";
import type { SessionContext } from "@/lib/auth/session";
import classes from "@/styles/leadely-shell.module.css";
import { useTranslations } from "next-intl";

type NavRole = "owner" | "admin" | "member" | "super_admin" | "support";
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: NavRole[];
  feature?: "mcp_access";
};
type NavGroup = {
  id: string;
  label?: string;
  items: NavItem[];
};

const workspaceGroups: NavGroup[] = [
  {
    id: "home",
    items: [{ href: "/app", label: "home", icon: LayoutDashboard, roles: ["owner", "admin", "member"] }],
  },
  {
    id: "find",
    label: "Find",
    items: [
      { href: "/app/leads/sources", label: "sources", icon: Library, roles: ["owner", "admin", "member"] },
      { href: "/app/leads/scrape", label: "scrape", icon: Radar, roles: ["owner", "admin", "member"] },
      { href: "/app/data", label: "dataLibrary", icon: Database, roles: ["owner", "admin", "member"] },
      { href: "/app/leads", label: "leads", icon: UserPlus, roles: ["owner", "admin", "member"] },
      { href: "/app/lists", label: "lists", icon: ListFilter, roles: ["owner", "admin", "member"] },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { href: "/app/companies", label: "companies", icon: Building2, roles: ["owner", "admin", "member"] },
      { href: "/app/contacts", label: "contacts", icon: Users, roles: ["owner", "admin", "member"] },
      { href: "/app/deals", label: "deals", icon: BriefcaseBusiness, roles: ["owner", "admin", "member"] },
      { href: "/app/tasks", label: "tasks", icon: CheckSquare, roles: ["owner", "admin", "member"] },
    ],
  },
  {
    id: "sell",
    label: "Sell",
    items: [
      { href: "/app/quotes", label: "quotes", icon: FileText, roles: ["owner", "admin", "member"] },
      { href: "/app/modules", label: "modules", icon: PackagePlus, roles: ["owner", "admin", "member"] },
      { href: "/app/contracts", label: "contracts", icon: FileText, roles: ["owner", "admin"] },
    ],
  },
  {
    id: "engage",
    label: "Engage",
    items: [
      { href: "/app/inbox", label: "inbox", icon: Inbox, roles: ["owner", "admin", "member"] },
      { href: "/app/calendar", label: "calendar", icon: CalendarDays, roles: ["owner", "admin", "member"] },
      { href: "/app/sequences", label: "sequences", icon: Mail, roles: ["owner", "admin", "member"] },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/app/team", label: "team", icon: Users, roles: ["owner", "admin"] },
      { href: "/app/crm-integrations", label: "crmIntegration", icon: Share2, roles: ["owner", "admin", "member"] },
      { href: "/app/mcp", label: "mcp", icon: Network, roles: ["owner", "admin"], feature: "mcp_access" },
    ],
  },
];

const platformGroups: NavGroup[] = [
  {
    id: "platform",
    items: [
      { href: "/app/platform", label: "overview", icon: LayoutDashboard, roles: ["super_admin", "support"] },
      { href: "/app/platform/accounts", label: "accounts", icon: Users, roles: ["super_admin", "support"] },
      { href: "/app/platform/workspaces", label: "workspaces", icon: Building2, roles: ["super_admin", "support"] },
      { href: "/app/platform/plans", label: "plans", icon: PackagePlus, roles: ["super_admin", "support"] },
      { href: "/app/platform/payments", label: "payments", icon: CreditCard, roles: ["super_admin", "support"] },
      { href: "/app/platform/crm-integrations", label: "crmIntegration", icon: Share2, roles: ["super_admin", "support"] },
      { href: "/app/platform/mcp", label: "mcp", icon: Network, roles: ["super_admin", "support"] },
      { href: "/app/platform/health", label: "health", icon: HeartPulse, roles: ["super_admin"] },
      { href: "/app/platform/audit", label: "audit", icon: ScrollText, roles: ["super_admin", "support"] },
    ],
  },
];

function navItemActive(pathname: string, href: string) {
  if (href === "/app" || href === "/app/platform") return pathname === href;
  if (href === "/app/leads") {
    return (
      pathname === "/app/leads" ||
      (pathname.startsWith("/app/leads/") && !pathname.startsWith("/app/leads/scrape") && !pathname.startsWith("/app/leads/sources"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellNav({
  context,
  children,
}: {
  context: Extract<SessionContext, { kind: "workspace" } | { kind: "platform" }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tNav = useTranslations("Navigation");
  const tCommon = useTranslations("Common");
  const tShell = useTranslations("Shell");
  const [opened, { toggle, close }] = useDisclosure();
  const role = context.kind === "platform" ? context.platformRole : context.memberRole;
  const groups = (context.kind === "platform" ? platformGroups : workspaceGroups)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role) && (context.kind !== "workspace" || !item.feature || context.plan.features[item.feature])),
    }))
    .filter((group) => group.items.length > 0);

  const locked =
    context.kind === "workspace" && (context.locked || context.planStatus === "expired" || context.planStatus === "canceled");
  const pastDue = context.kind === "workspace" && context.planStatus === "past_due";
  const accountLabel = context.kind === "platform" ? context.platformRole : context.memberRole;

  return (
    <AppShell
      header={{ height: { base: 60, md: 0 } }}
      navbar={{ width: 220, breakpoint: "md", collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className={classes.navbar} hiddenFrom="md">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} size="sm" />
            <AppLogo compact />
          </Group>
          {context.kind === "workspace" ? (
            <LinkButton href="/app/quotes/new" size="compact-md" leftSection={<Plus size={14} />}>
              {tCommon("new")}
            </LinkButton>
          ) : null}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={classes.navbar} px="md">
        <div className={classes.brand}>
          <AppLogo platform={context.kind === "platform"} />
        </div>

        <ScrollArea className={classes.nav} type="hover" offsetScrollbars={false} scrollbarSize={6}>
          <Stack gap={2}>
            {groups.map((group) => (
              <div key={group.id} className={classes.navGroup}>
                {group.label ? <Text className={classes.navSection}>{tNav(group.id)}</Text> : null}
                {group.items.map((item) => (
                  <ShellLink key={item.href} item={item} label={tNav(item.label)} pathname={pathname} onClick={close} />
                ))}
              </div>
            ))}
          </Stack>
        </ScrollArea>

        <div className={classes.footer}>
          <form action={signOut} id="leadely-signout" style={{ display: "none" }} />
          <Menu shadow="md" width={220} position="top-end">
            <Menu.Target>
              <UnstyledButton className={classes.userButton}>
                <Group gap={10} wrap="nowrap">
                  <Avatar size={32} radius="xl" color="leadely">
                    {context.email.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      {context.email.split("@")[0]}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {accountLabel}
                      {context.kind === "workspace" ? ` · ${context.plan.name}` : ""}
                    </Text>
                  </div>
                  <ChevronUp size={16} color="#94a3b8" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              {context.kind === "workspace" ? (
                <>
                  <Menu.Item component={Link} href="/app/settings" leftSection={<Settings size={16} />}>
                    {tCommon("settings")}
                  </Menu.Item>
                  {context.memberRole === "owner" ? (
                    <Menu.Item component={Link} href="/app/billing" leftSection={<CreditCard size={16} />}>
                      {tCommon("billing")}
                    </Menu.Item>
                  ) : null}
                </>
              ) : null}
              <Menu.Item
                color="red"
                leftSection={<LogOut size={16} />}
                onClick={() => {
                  const form = document.getElementById("leadely-signout");
                  if (form instanceof HTMLFormElement) form.requestSubmit();
                }}
              >
                {tCommon("signOut")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <div className={classes.content}>
          <ContentContainer>
            {locked ? (
              <Alert color="red" title={tShell("lockedTitle")} mb="md">
                {tShell("lockedBody")}
              </Alert>
            ) : null}
            {pastDue ? (
              <Alert color="yellow" title={tShell("pastDueTitle")} mb="md">
                {tShell("pastDueBody")}
              </Alert>
            ) : null}
            {children}
          </ContentContainer>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

function ShellLink({
  item,
  label,
  pathname,
  onClick,
}: {
  item: NavItem;
  label: string;
  pathname: string;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const router = useRouter();
  const lastPrefetch = useRef(0);
  const prefetch = () => {
    if (pathname === item.href || Date.now() - lastPrefetch.current < 30_000) return;
    lastPrefetch.current = Date.now();
    router.prefetch(item.href);
  };
  return (
    <NavLink
      component={Link}
      href={item.href}
      prefetch={false}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      label={label}
      leftSection={<Icon size={18} />}
      active={navItemActive(pathname, item.href)}
      onClick={onClick}
      className={classes.navItem}
    />
  );
}

export { AppShellNav as AppShell };
