import { Avatar, Group, Text } from "@mantine/core";
import { Building2, ChevronRight } from "lucide-react";
import { clientInitials } from "@/lib/image";
import { LinkAnchor } from "@/components/mantine-link";
import { DashboardPanel } from "./dashboard-panel";
import { CompactEmpty } from "./compact-empty";
import { compactVnd } from "./period";
import type { DashboardCompanyRank } from "./types";
import classes from "@/styles/leadely-dashboard.module.css";

export function TopCompaniesPanel({ companies }: { companies: DashboardCompanyRank[] }) {
  return (
    <DashboardPanel
      title="Top Companies"
      minHeight={300}
      className={classes.rowTable}
      action={
        <LinkAnchor href="/app/companies" size="sm" c="leadely" fw={600}>
          All
        </LinkAnchor>
      }
    >
      {companies.length === 0 ? (
        <CompactEmpty
          icon={<Building2 size={14} />}
          title="No companies ranked"
          description="Companies with open deals will appear here."
          href="/app/companies"
          actionLabel="Add company"
        />
      ) : (
        <div>
          {companies.slice(0, 5).map((company) => (
            <LinkAnchor key={company.id} href={`/app/companies/${company.id}`} underline="never" className={classes.companyRow} style={{ display: "block" }}>
              <Group wrap="nowrap" justify="space-between" gap="sm" px={4}>
                <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
                  <Avatar src={company.logo || undefined} size={32} radius="md" color="leadely">
                    {clientInitials(company.name)}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} lineClamp={1} c="#182235">
                      {company.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {company.deals} open · {compactVnd(company.value)}
                    </Text>
                  </div>
                </Group>
                <ChevronRight size={16} color="#94a3b8" />
              </Group>
            </LinkAnchor>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
