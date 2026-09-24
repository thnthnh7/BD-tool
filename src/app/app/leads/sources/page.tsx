import { Avatar, Badge, Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { Library, Search, Star, Users } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { installScrapeSourceAction, listScrapeSources, uninstallScrapeSourceAction } from "@/features/leads/server/source-actions";
import { summarizePricing, type ActorPricing } from "@/features/leads/source-pricing";
import { requireWorkspace } from "@/lib/auth/session";
import { readListQuery } from "@/lib/list-page";
import classes from "@/features/leads/components/source-cards.module.css";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";

const CATEGORIES = ["LEAD_GENERATION", "SOCIAL_MEDIA", "MARKETING", "ECOMMERCE", "SEO_TOOLS", "JOBS", "REAL_ESTATE", "TRAVEL", "AI", "AUTOMATION"];

function initial(title: string) {
  const char = Array.from(title).find((item) => /\p{L}|\p{N}/u.test(item));
  return char ? char.toLocaleUpperCase("en") : "?";
}

export default async function LeadSourcesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; installed?: string; category?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = readListQuery(params);
  const installed = params.installed === "yes" || params.installed === "no" ? params.installed : "";
  const category = CATEGORIES.includes(params.category || "") ? params.category || "" : "";
  const context = await requireWorkspace();
  const [payload, apify] = await Promise.all([listScrapeSources({ q, page, adapter: "", installed, category }), getCurrentWorkspaceApifyStatus()]);
  const canManage = context.memberRole !== "member" && Boolean(context.plan.features.lead_scrape);
  const extra = { installed, category };
  return <Stack gap="lg">
    <PageHeader title="Sources" subtitle={`${payload.catalogTotal.toLocaleString("vi-VN")} actor Pay per event · Khám phá và cài nguồn dữ liệu cho workspace.`}
      action={<LinkButton href="/app/leads/scrape" variant="light">Scrape</LinkButton>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact />
    <form action="/app/leads/sources">
      <Group gap="sm" wrap="wrap">
        <TextInput name="q" defaultValue={q} placeholder="Tìm actor theo tên, mô tả hoặc slug…" aria-label="Tìm nguồn" leftSection={<Search size={16} />} style={{ flex: "1 1 280px" }} />
        <NativeSelect name="installed" aria-label="Đã cài" defaultValue={installed}
          data={[{ value: "", label: "Tất cả nguồn" }, { value: "yes", label: "Đã cài" }, { value: "no", label: "Chưa cài" }]} />
        <NativeSelect name="category" aria-label="Nhóm" defaultValue={category}
          data={[{ value: "", label: "Mọi nhóm" }, ...CATEGORIES.map((item) => ({ value: item, label: item.replaceAll("_", " ") }))]} />
        <Button type="submit" variant="light">Lọc</Button>
      </Group>
    </form>
    <Text size="xs" c="dimmed">Giá tham khảo bằng USD theo gói Apify Free. Tổng phí phụ thuộc các event và tùy chọn bạn sử dụng.</Text>
    {payload.total === 0 ? <EmptyState icon={<Library size={18} />} title="Không có nguồn phù hợp" description="Thử đổi từ khóa hoặc bộ lọc để tìm actor Pay per event." /> : <>
      <div className={classes.grid}>
        {payload.rows.map((source) => {
          const pricing = summarizePricing(source.pricing_info as ActorPricing | undefined);
          const author = source.slug.split("/")[0];
          return <article key={source.id} className={classes.card} aria-label={source.title}>
            <div className={classes.body}>
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Avatar src={source.picture_url || undefined} radius="sm" size={40}>{initial(source.title)}</Avatar>
                <div className={classes.title}>
                  <Text fw={600} size="sm" truncate title={source.title}>{source.title}</Text>
                  <Text size="xs" c="dimmed" truncate title={source.slug} ff="monospace">{source.slug}</Text>
                </div>
              </Group>
              <Text size="sm" lineClamp={3} className={classes.description}>{source.description || source.slug}</Text>
              <div className={classes.price}>
                <Text fw={600} size="sm" c="teal.8">{pricing ? `${pricing.amount} / ${pricing.unit}` : "Chưa lấy được đơn giá"}</Text>
                {pricing ? <details className={classes.details}>
                  <summary>Chi tiết giá · {pricing.events.length} event</summary>
                  <ul>{pricing.events.map((event, index) => <li key={index}>{event.title}: {event.amount} / event</li>)}</ul>
                  <span>Giá theo gói Free; phí tài nguyên có thể tính riêng tùy actor.</span>
                </details> : <Text component="a" href={`https://apify.com/${source.slug}`} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">Xem giá trên Apify</Text>}
              </div>
              <Group justify="space-between" gap="xs">
                {source.installed ? <Badge size="sm" color="teal" variant="light">Đã cài</Badge> : <Text size="xs" c="dimmed">Pay per event</Text>}
                {canManage && <ActionForm action={source.installed ? uninstallScrapeSourceAction : installScrapeSourceAction}
                  submitLabel={source.installed ? "Gỡ" : "Cài"} variant="light" layout="inline">
                  <input type="hidden" name="source_id" value={source.id} />
                </ActionForm>}
              </Group>
            </div>
            <div className={classes.footer}>
              <Text size="xs" truncate className={classes.author} title={author}>{author}</Text>
              <Group gap={4} wrap="nowrap" aria-label={`Rating ${source.review_rating?.toFixed(1) || "chưa có"}`}>
                <Star size={13} /><Text size="xs">{source.review_rating?.toFixed(1) || "—"}</Text>
              </Group>
              <Group gap={4} wrap="nowrap" title={`${source.total_users.toLocaleString("vi-VN")} người dùng`}>
                <Users size={13} /><Text size="xs">{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(source.total_users)}</Text>
              </Group>
            </div>
          </article>;
        })}
      </div>
      <ListFooter path="/app/leads/sources" q={q} extra={extra} {...payload} singular="nguồn" plural="nguồn" />
    </>}
  </Stack>;
}
