import { Badge } from "@mantine/core";
import { useTranslations } from "next-intl";

const statuses: Record<string, string> = {
  queued: "gray", running: "blue", ingesting: "cyan", succeeded: "teal", failed: "red", canceled: "gray",
};
export function ScrapeStatus({ status }: { status: string }) {
  const t = useTranslations("Scrape");
  return <Badge color={statuses[status] || "gray"} variant="light">{status in statuses ? t(status) : status}</Badge>;
}
