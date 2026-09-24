import type { ReactNode } from "react";
import { Text, ThemeIcon } from "@mantine/core";
import classes from "@/styles/leadely-dashboard.module.css";
import { LinkButton } from "@/components/mantine-link";

export function CompactEmpty({
  icon,
  title,
  description,
  href,
  actionLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className={classes.empty}>
      <ThemeIcon size={28} radius="md" color="leadely" variant="light">
        {icon}
      </ThemeIcon>
      <Text size="sm" fw={600} c="#182235">
        {title}
      </Text>
      <Text size="xs" c="dimmed" maw={220}>
        {description}
      </Text>
      {href && actionLabel ? (
        <LinkButton href={href} size="compact-sm" variant="light" mt={4}>
          {actionLabel}
        </LinkButton>
      ) : null}
    </div>
  );
}
