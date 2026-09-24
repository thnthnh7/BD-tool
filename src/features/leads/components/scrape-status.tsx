import { Badge } from "@mantine/core";

const statuses: Record<string, { label: string; color: string }> = {
  queued: { label: "Đang chờ", color: "gray" }, running: { label: "Đang chạy", color: "blue" },
  ingesting: { label: "Đang đồng bộ", color: "cyan" }, succeeded: { label: "Hoàn tất", color: "teal" },
  failed: { label: "Thất bại", color: "red" }, canceled: { label: "Đã hủy", color: "gray" },
};
export function ScrapeStatus({ status }: { status: string }) {
  const value = statuses[status] || { label: status, color: "gray" };
  return <Badge color={value.color} variant="light">{value.label}</Badge>;
}
