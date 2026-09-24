import type { ReactNode } from "react";
import { Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import classes from "@/styles/leadely-dashboard.module.css";

export function MetricCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <Paper withBorder radius="lg" className={`${classes.panel} ${classes.metric}`}>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        {icon ? (
          <ThemeIcon size={40} radius="md" color="leadely" variant="light">
            {icon}
          </ThemeIcon>
        ) : null}
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text className={classes.metricLabel} lineClamp={1}>
            {label}
          </Text>
          <Text className={classes.metricValue} lineClamp={1}>
            {value}
          </Text>
          {hint ? (
            <Text className={classes.metricHint} lineClamp={1}>
              {hint}
            </Text>
          ) : null}
        </Stack>
      </Group>
    </Paper>
  );
}
