import type { ReactNode } from "react";
import { Avatar, Group, Stack, Text, Title } from "@mantine/core";
import { ChevronLeft } from "lucide-react";
import { LinkAnchor } from "@/components/mantine-link";
import classes from "@/styles/leadely-dashboard.module.css";

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  mark,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: { href: string; label: string };
  mark?: { src?: string; initials: string };
}) {
  return (
    <Stack gap={6} mb={4}>
      {back ? (
        <LinkAnchor href={back.href} size="sm" c="dimmed" style={{ display: "inline-flex", alignItems: "center", gap: 2, width: "fit-content" }}>
          <ChevronLeft size={14} />
          {back.label}
        </LinkAnchor>
      ) : null}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Group wrap="nowrap" gap="sm" align="center" style={{ minWidth: 0 }}>
      {mark ? (
        <Avatar src={mark.src || undefined} radius="md" size={44} color="leadely">
          {mark.initials}
        </Avatar>
      ) : null}
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Title order={1} className={classes.greeting}>
          {title}
        </Title>
        {subtitle ? (
          <Text className={classes.subtitle} maw={640} lineClamp={2}>
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      </Group>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
      </Group>
    </Stack>
  );
}
