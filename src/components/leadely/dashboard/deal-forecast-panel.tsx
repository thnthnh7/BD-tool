"use client";

import { useMemo, useState } from "react";
import { Group, NativeSelect, Text } from "@mantine/core";
import { convertCurrency, DEAL_CURRENCIES, formatCurrency } from "@/lib/money";
import { DashboardPanel } from "./dashboard-panel";
import { inPeriod, PERIOD_OPTIONS } from "./period";
import type { DashboardDealPoint, PeriodKey } from "./types";
import classes from "@/styles/leadely-dashboard.module.css";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: monthKey(date),
      label: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

function AreaChart({ values }: { values: number[] }) {
  const width = 320;
  const height = 88;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 8 - (value / max) * (height - 16);
    return { x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={classes.chart} role="img" aria-label="Deal forecast chart">
      <path d={area} fill="rgba(16,185,129,0.14)" />
      <path d={line} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DealForecastPanel({ deals, usdRates }: { deals: DashboardDealPoint[]; usdRates: Record<string, number> }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const currencies = [...DEAL_CURRENCIES];
  const initialCurrency = deals[0]?.currency && currencies.includes(deals[0].currency as (typeof DEAL_CURRENCIES)[number]) ? deals[0].currency : "VND";
  const [currency, setCurrency] = useState(initialCurrency);
  const activeCurrency = currencies.includes(currency as (typeof DEAL_CURRENCIES)[number]) ? currency : "VND";
  const { projected, months, values } = useMemo(() => {
    const filtered = deals.filter((deal) => inPeriod(deal.date, period, deal.date));
    const projectedValue = filtered.reduce(
      (sum, deal) => sum + convertCurrency(deal.amount, deal.currency, activeCurrency, usdRates) * (deal.probability / 100),
      0,
    );
    const buckets = lastSixMonths();
    const valuesByMonth = buckets.map((bucket) =>
      deals
        .filter((deal) => monthKey(new Date(deal.date)) === bucket.key)
        .reduce(
          (sum, deal) => sum + convertCurrency(deal.amount, deal.currency, activeCurrency, usdRates) * (deal.probability / 100),
          0,
        ),
    );
    return { projected: projectedValue, months: buckets, values: valuesByMonth };
  }, [activeCurrency, deals, period, usdRates]);

  return (
    <DashboardPanel
      title="Deal Forecast"
      minHeight={300}
      className={classes.rowTable}
      action={
        <Group gap={6} wrap="nowrap">
          <NativeSelect w={82} data={currencies} value={activeCurrency} onChange={(event) => setCurrency(event.currentTarget.value)} aria-label="Forecast currency" />
          <NativeSelect
            className={classes.period}
            w={118}
            data={PERIOD_OPTIONS}
            value={period}
            onChange={(event) => setPeriod(event.currentTarget.value as PeriodKey)}
            aria-label="Forecast period"
          />
        </Group>
      }
    >
      <Text className={classes.forecastValue}>{formatCurrency(projected, activeCurrency)}</Text>
      <Text size="xs" c="dimmed" mb="sm">
        Weighted expected close
      </Text>
      <Group gap="md" mb="xs">
        <Group gap={6}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "#059669" }} />
          <Text size="xs" c="dimmed">
            Weighted
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {months[0]?.label}–{months[months.length - 1]?.label}
        </Text>
      </Group>
      <AreaChart values={values} />
    </DashboardPanel>
  );
}
