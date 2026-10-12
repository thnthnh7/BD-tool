import { loadMarketingDashboard } from "@/lib/platform/marketing";

function csvCell(value: string | number) { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") || 30);
  const data = await loadMarketingDashboard(days);
  const rows = [["Landing page", "Sessions", "Pageviews", "Average engagement seconds", "Bounce rate"]];
  for (const row of data.content) rows.push([row.path, String(row.sessions), String(row.pageviews), (row.engagement / Math.max(1, row.sessions) / 1000).toFixed(1), (row.bounced / Math.max(1, row.sessions)).toFixed(4)]);
  return new Response(rows.map((row) => row.map(csvCell).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bizcraw-marketing-${data.days}d.csv"`, "cache-control": "private, no-store" } });
}
