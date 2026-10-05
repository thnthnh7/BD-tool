"use client";

import Link from "next/link";
import { Avatar, Badge, Group, Menu, Text } from "@mantine/core";
import { Building2, MoreHorizontal, UserPlus } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { LinkAnchor } from "@/components/mantine-link";
import { DashboardPanel } from "./dashboard-panel";
import { CompactEmpty } from "./compact-empty";
import { initials, relativeTime, titleCase } from "./period";
import type { DashboardLead } from "./types";
import classes from "@/styles/leadely-dashboard.module.css";

const STATUS_COLOR: Record<string, string> = {
  new: "blue",
  working: "yellow",
  connected: "teal",
  qualified: "leadely",
  unqualified: "gray",
  draft: "gray",
  sent: "blue",
  won: "leadely",
  lost: "red",
};

export function RecentLeadsPanel({ leads, title = "Recent Leads" }: { leads: DashboardLead[]; title?: string }) {
  return (
    <DashboardPanel
      title={title}
      minHeight={300}
      padded={false}
      className={classes.rowTable}
      action={
        <LinkAnchor href="/app/leads" size="sm" c="leadely" fw={600}>
          View all
        </LinkAnchor>
      }
    >
      {leads.length === 0 ? (
        <CompactEmpty icon={<UserPlus size={14} />} title="No leads yet" description="Import from Maps or add a lead to fill this table." href="/app/leads/scrape" actionLabel="Find leads" />
      ) : (
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Name</TableTh>
                <TableTh>Company</TableTh>
                <TableTh style={{ whiteSpace: "nowrap" }}>Status</TableTh>
                <TableTh style={{ whiteSpace: "nowrap" }}>Last activity</TableTh>
                <TableTh w={36} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {leads.slice(0, 6).map((lead) => (
                <TableTr key={lead.id}>
                  <TableTd>
                    <Group gap={8} wrap="nowrap">
                      <Avatar size={28} radius="xl" color="leadely">
                        {initials(lead.name)}
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} lineClamp={1}>
                          {lead.name}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {lead.email || "No email"}
                        </Text>
                      </div>
                    </Group>
                  </TableTd>
                  <TableTd>
                    <Group gap={6} wrap="nowrap">
                      <Avatar src={lead.companyLogo || undefined} size={22} radius="sm" color="gray">
                        {lead.company ? initials(lead.company) : <Building2 size={12} />}
                      </Avatar>
                      <Text size="sm" lineClamp={1}>
                        {lead.company || "—"}
                      </Text>
                    </Group>
                  </TableTd>
                  <TableTd style={{ whiteSpace: "nowrap" }}>
                    <Badge color={STATUS_COLOR[lead.status] || "gray"} variant="light" title={titleCase(lead.source || "manual")}>
                      {titleCase(lead.status)}
                    </Badge>
                  </TableTd>
                  <TableTd>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {relativeTime(lead.lastActivityAt)}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Menu shadow="sm" position="bottom-end">
                      <Menu.Target>
                        <button type="button" aria-label="Lead actions" style={{ border: 0, background: "transparent", cursor: "pointer", color: "#748098" }}>
                          <MoreHorizontal size={16} />
                        </button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item component={Link} href={lead.href}>
                          Open
                        </Menu.Item>
                        {lead.companyId ? (
                          <Menu.Item component={Link} href={`/app/companies/${lead.companyId}`}>
                            Open company
                          </Menu.Item>
                        ) : null}
                      </Menu.Dropdown>
                    </Menu>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      )}
    </DashboardPanel>
  );
}
