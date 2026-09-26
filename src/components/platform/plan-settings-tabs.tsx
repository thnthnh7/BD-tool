"use client";

import { Children, type ReactNode } from "react";
import { Tabs } from "@mantine/core";
import classes from "@/styles/platform-plans.module.css";

type PlanTab = {
  id: string;
  name: string;
};

export function PlanSettingsTabs({
  activePlan,
  plans,
  children,
  newPlanPanel,
}: {
  activePlan: string;
  plans: PlanTab[];
  children: ReactNode;
  newPlanPanel?: ReactNode;
}) {
  const panels = Children.toArray(children);

  return (
    <Tabs defaultValue={activePlan} classNames={{ list: classes.tabList, tab: classes.tab }}>
      <Tabs.List>
        {plans.map((plan) => (
          <Tabs.Tab key={plan.id} value={plan.id}>{plan.name}</Tabs.Tab>
        ))}
        {newPlanPanel ? <Tabs.Tab value="new">+ New plan</Tabs.Tab> : null}
      </Tabs.List>

      {plans.map((plan, index) => (
        <Tabs.Panel key={plan.id} value={plan.id} pt="md">
          {panels[index]}
        </Tabs.Panel>
      ))}

      {newPlanPanel ? (
        <Tabs.Panel value="new" pt="md">{newPlanPanel}</Tabs.Panel>
      ) : null}
    </Tabs>
  );
}
