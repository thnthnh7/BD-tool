import type { ReactNode } from "react";
import { Stack, Text, ThemeIcon } from "@mantine/core";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Use inside a panel that sits next to other panels, so heights stay comparable. */
  compact?: boolean;
}) {
  return (
    <Stack align="center" gap={compact ? 6 : "sm"} py={compact ? "lg" : "xl"} ta="center">
      <ThemeIcon size={compact ? 28 : 36} radius="md" color="leadely" variant="light">
        {icon}
      </ThemeIcon>
      <Text fw={600} size={compact ? "sm" : "lg"} c="var(--ld-text)">
        {title}
      </Text>
      <Text size={compact ? "xs" : "sm"} c="dimmed" maw={compact ? 260 : 360}>
        {description}
      </Text>
      {action}
    </Stack>
  );
}
