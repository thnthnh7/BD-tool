import type { ReactNode } from "react";
import { Box, Group, Paper, Text } from "@mantine/core";
import classes from "@/styles/leadely-dashboard.module.css";

export type PanelProps = {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  minHeight?: number;
  /** Apply the standard inner padding. Turn off for edge-to-edge tables. */
  padded?: boolean;
  /** Stretch to the full height of the parent grid column. */
  fill?: boolean;
  className?: string;
};

export function Panel({ title, action, children, minHeight, padded = true, fill = false, className }: PanelProps) {
  const hasHeader = Boolean(title || action);
  return (
    <Paper
      withBorder
      radius="lg"
      className={`${classes.panel} ${className || ""}`}
      style={{ minHeight, height: fill ? "100%" : undefined }}
    >
      {hasHeader ? (
        <Group justify="space-between" wrap="nowrap" px="md" pt="md" pb={8} gap="sm">
          {typeof title === "string" ? <Text className={classes.panelTitle}>{title}</Text> : title || <span />}
          {action}
        </Group>
      ) : null}
      <Box
        px={padded ? "md" : 0}
        pt={hasHeader || !padded ? 0 : "md"}
        pb={padded ? "md" : 0}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        {children}
      </Box>
    </Paper>
  );
}
