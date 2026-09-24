import { Badge } from "@mantine/core";

const statusMap = {
  draft: { label: "Draft", color: "gray" },
  sent: { label: "Sent", color: "blue" },
  won: { label: "Won", color: "leadely" },
  lost: { label: "Lost", color: "red" },
  accepted: { label: "Accepted", color: "leadely" },
  signed: { label: "Signed", color: "leadely" },
  expired: { label: "Expired", color: "orange" },
  void: { label: "Void", color: "red" },
  new: { label: "New", color: "blue" },
  working: { label: "Working", color: "orange" },
  connected: { label: "Connected", color: "blue" },
  qualified: { label: "Qualified", color: "leadely" },
  unqualified: { label: "Unqualified", color: "red" },
  converted: { label: "Converted", color: "leadely" },
  open: { label: "Open", color: "blue" },
  completed: { label: "Completed", color: "leadely" },
  active: { label: "Active", color: "leadely" },
  paused: { label: "Paused", color: "gray" },
} as const;

function prettify(status: string) {
  const text = status.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

export function StatusBadge({ status }: { status: string }) {
  const mapped = statusMap[status as keyof typeof statusMap];
  return (
    <Badge color={mapped?.color || "gray"} variant="light">
      {mapped?.label || prettify(status)}
    </Badge>
  );
}
