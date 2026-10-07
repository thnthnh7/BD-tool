import { Avatar, Button, Group, NativeSelect, Skeleton, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { Suspense } from "react";
import Form from "next/form";
import { CheckCircle2, Library, Search, Star, Users } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { LinkButton } from "@/components/mantine-link";
import { listScrapeSources } from "@/features/leads/server/source-actions";
import { summarizePricing, type ActorPricing } from "@/features/leads/source-pricing";
import { requireWorkspace, requireModule } from "@/lib/auth/session";
import { readListQuery } from "@/lib/list-page";
import classes from "@/features/leads/components/source-cards.module.css";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { getLocale, getTranslations } from "next-intl/server";
import { SourceCardActions } from "@/features/leads/components/source-card-actions";
import { getScrapeJobSummary } from "@/features/leads/server/scrape-actions";

const CATEGORIES = ["LEAD_GENERATION", "SOCIAL_MEDIA", "MARKETING", "ECOMMERCE", "SEO_TOOLS", "JOBS", "REAL_ESTATE", "TRAVEL", "AI", "AUTOMATION"];

async function SourcesAccount({ installedCount }: { installedCount: number }) {
  const [apify, summary, t] = await Promise.all([getCurrentWorkspaceApifyStatus(), getScrapeJobSummary(), getTranslations("Scrape")]);
  return <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact
    activitySummary={[t("installedCount", { count: installedCount }), t("runCount", { count: summary.total }), ...(summary.active > 0 ? [t("activeCount", { count: summary.active })] : [])]} />;
}

function initial(title: string) {
  const char = Array.from(title).find((item) => /\p{L}|\p{N}/u.test(item));
  return char ? char.toLocaleUpperCase("en") : "?";
}

export default async function LeadSourcesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string; installed?: string; category?: string }>;
}) {
  await requireModule("sources");
  const params = await searchParams;
  const [t, scrapeT, locale] = await Promise.all([getTranslations("Sources"), getTranslations("Scrape"), getLocale()]);
  const { q, page } = readListQuery(params);
  const installed = params.installed === "yes" || params.installed === "no" ? params.installed : "";
  const category = CATEGORIES.includes(params.category || "") ? params.category || "" : "";
  const context = await requireWorkspace();
  const payload = await listScrapeSources({ q, page, adapter: "", installed, category });
  const usersFormat = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 0 });
  const canManage = context.memberRole !== "member" && Boolean(context.plan.features.lead_scrape);
  const extra = { installed, category };
  return <Stack gap="lg" data-tutorial-id="sources-page">
    <PageHeader title={t("title")} subtitle={t("subtitle", { count: payload.catalogTotal.toLocaleString(locale) })}
      action={<LinkButton href="/app/leads/scrape" variant="light">{scrapeT("title")}</LinkButton>} />
    <Suspense fallback={<Skeleton height={92} radius="lg" />}><SourcesAccount installedCount={payload.installedIds.length} /></Suspense>
    <div data-tutorial-id="sources-filters">
      <Form key={`${q}:${installed}:${category}`} action="/app/leads/sources" prefetch={false}>
        <Group gap="sm" wrap="wrap">
        <TextInput name="q" defaultValue={q} placeholder={t("search")} aria-label={t("searchLabel")} leftSection={<Search size={16} />} style={{ flex: "1 1 280px" }} />
        <NativeSelect name="installed" aria-label={t("installed")} defaultValue={installed}
          data={[{ value: "", label: t("all") }, { value: "yes", label: t("installed") }, { value: "no", label: t("notInstalled") }]} />
        <NativeSelect name="category" aria-label={t("category")} defaultValue={category}
          data={[{ value: "", label: t("allCategories") }, ...CATEGORIES.map((item) => ({ value: item, label: item.replaceAll("_", " ") }))]} />
        <Button type="submit" variant="light">{t("filter")}</Button>
        </Group>
      </Form>
    </div>
    <Text size="xs" c="dimmed">{t("priceNote")}</Text>
    {payload.total === 0 ? <EmptyState icon={<Library size={18} />} title={t("emptyTitle")} description={t("emptyDescription")} /> : <>
      <div className={classes.grid} data-tutorial-id="sources-catalog">
        {payload.rows.map((source) => {
          const pricing = summarizePricing(source.pricing_info as ActorPricing | undefined);
          const author = source.slug.split("/")[0];
          return <article key={source.id} className={classes.card} aria-label={source.title}>
            <div className={classes.body}>
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Avatar src={source.picture_url || undefined} imageProps={{ loading: "lazy", decoding: "async" }} radius="sm" size={40}>{initial(source.title)}</Avatar>
                <div className={classes.title}>
                  <Group gap={5} wrap="nowrap">
                    <Text fw={600} size="sm" truncate title={source.title}>{source.title}</Text>
                    {source.installed ? (
                      <Tooltip label={t("installed")}>
                        <CheckCircle2 className={classes.installedIcon} size={15} aria-label={t("installed")} />
                      </Tooltip>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed" truncate title={source.slug} ff="monospace">{source.slug}</Text>
                </div>
              </Group>
              <Text size="sm" lineClamp={3} className={classes.description}>{source.description || source.slug}</Text>
              <div className={classes.price}>
                <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
                  <Text fw={600} size="sm" c="teal.8" className={classes.priceText}>{pricing ? `${pricing.amount} / ${pricing.unit}` : t("noPrice")}</Text>
                  <SourceCardActions
                    sourceId={source.id}
                    installed={source.installed}
                    canManage={canManage}
                    installLabel={t("install")}
                    runLabel={scrapeT("newRun")}
                    removeLabel={t("uninstall")}
                  />
                </Group>
                {pricing ? <details className={classes.details}>
                  <summary>{t("priceDetails", { count: pricing.events.length })}</summary>
                  <ul>{pricing.events.map((event, index) => <li key={index}>{event.title}: {event.amount} / event</li>)}</ul>
                  <span>{t("priceDisclaimer")}</span>
                </details> : <Text component="a" href={`https://apify.com/${source.slug}`} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">{t("viewPrice")}</Text>}
              </div>
            </div>
            <div className={classes.footer}>
              <Text size="xs" truncate className={classes.author} title={author}>{author}</Text>
              <Group gap={4} wrap="nowrap" aria-label={`Rating ${source.review_rating?.toFixed(1) || t("unknownRating")}`}>
                <Star size={13} /><Text size="xs">{source.review_rating?.toFixed(1) || "—"}</Text>
              </Group>
              <Group gap={4} wrap="nowrap" title={t("users", { count: source.total_users.toLocaleString(locale) })}>
                <Users size={13} /><Text size="xs">{usersFormat.format(source.total_users)}</Text>
              </Group>
            </div>
          </article>;
        })}
      </div>
      <ListFooter path="/app/leads/sources" q={q} extra={extra} {...payload} singular={t("item")} plural={t("items")} ofLabel={locale === "vi" ? "của" : "of"} />
    </>}
  </Stack>;
}
