import type { ReactNode } from "react";
import { Avatar, Group, Stack, Text } from "@mantine/core";

export function EntityRow({
  title,
  subtitle,
  image,
  initials,
  right,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  initials?: string;
  right?: ReactNode;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Avatar src={image || undefined} radius="md" size={32} color="leadely">
          {initials}
        </Avatar>
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" c="dimmed" truncate>
              {subtitle}
            </Text>
          ) : null}
        </Stack>
      </Group>
      {right}
    </Group>
  );
}
