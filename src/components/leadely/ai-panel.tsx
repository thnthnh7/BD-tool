import type { ReactNode } from "react";
import { Badge, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { Sparkles } from "lucide-react";
import classes from "@/styles/leadely-surfaces.module.css";

export function AiPanel({
  title = "AI Assistant",
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="xl" p="lg" className={classes.aiPanel}>
      <Group justify="space-between" align="flex-start" mb="md">
        <Group gap="sm" align="flex-start">
          <ThemeIcon size={36} radius="md" color="leadely" variant="light">
            <Sparkles size={18} />
          </ThemeIcon>
          <Stack gap={2}>
            <Group gap={8}>
              <Text fw={700}>{title}</Text>
              <Badge size="xs" color="leadely">
                Beta
              </Badge>
            </Group>
            {description ? (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            ) : null}
          </Stack>
        </Group>
      </Group>
      {children}
    </Paper>
  );
}
