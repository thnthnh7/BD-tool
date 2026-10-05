"use client";

import { useMemo, useState } from "react";
import { NativeSelect, Text } from "@mantine/core";
import { GitBranch } from "lucide-react";
import { DashboardPanel } from "./dashboard-panel";
import { CompactEmpty } from "./compact-empty";
import { inPeriod, PERIOD_OPTIONS } from "./period";
import { currencyTotals, formatCurrencyTotals } from "@/lib/money";
import type { DashboardDealPoint, DashboardStage, PeriodKey } from "./types";
import classes from "@/styles/leadely-dashboard.module.css";

const BAR_COLORS = ["#A7F3D0", "#6EE7B7", "#34D399", "#10B981", "#059669", "#047857", "#065F46"];

export function PipelineOverview({ stages, deals }: { stages: DashboardStage[]; deals: DashboardDealPoint[] }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const bars = useMemo(() => {
    const filtered = deals.filter((deal) => inPeriod(deal.date, period, deal.date));
    return stages.map((stage) => {
      const items = filtered.filter((deal) => deal.stageId === stage.id);
      return {
        ...stage,
        count: items.length,
        totals: currencyTotals(items),
      };
    });
  }, [deals, period, stages]);
  const maxValue = Math.max(1, ...bars.map((bar) => bar.count));

  return (
    <DashboardPanel
      title="Pipeline Overview"
      minHeight={320}
      className={classes.rowPanel}
      action={
        <NativeSelect
          className={classes.period}
          w={132}
          data={PERIOD_OPTIONS}
          value={period}
          onChange={(event) => setPeriod(event.currentTarget.value as PeriodKey)}
          aria-label="Pipeline period"
        />
      }
    >
      {stages.length === 0 ? (
        <CompactEmpty icon={<GitBranch size={14} />} title="No pipeline yet" description="Deal stages will appear here once CRM data is available." href="/app/deals" actionLabel="Open deals" />
      ) : (
        <div className={classes.bars}>
          {bars.map((bar, index) => {
            const height = Math.max(bar.count ? 10 : 4, Math.round((bar.count / maxValue) * 132));
            return (
              <div key={bar.id} className={classes.barCol}>
                <div className={classes.barTrack}>
                  <Text className={classes.barMeta}>
                    {bar.count}
                    {Object.keys(bar.totals).length ? ` · ${formatCurrencyTotals(bar.totals, true)}` : ""}
                  </Text>
                  <div className={classes.barFill} style={{ height, background: BAR_COLORS[Math.min(index, BAR_COLORS.length - 1)] }} />
                </div>
                <div className={classes.barLabel} title={bar.name}>
                  {bar.name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
