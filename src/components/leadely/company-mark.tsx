import { Avatar, Group, Text } from "@mantine/core";
import { clientInitials } from "@/lib/image";

export function CompanyMark({
  name,
  logo,
  size = 28,
  fw = 500,
}: {
  name: string;
  logo?: string | null;
  size?: number;
  fw?: number;
}) {
  const label = name || "—";
  return (
    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
      <Avatar src={logo || undefined} radius="md" size={size} color="leadely">
        {clientInitials(label)}
      </Avatar>
      <Text size="sm" fw={fw} lineClamp={1}>
        {label}
      </Text>
    </Group>
  );
}
