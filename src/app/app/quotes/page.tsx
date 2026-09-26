import { Group, Stack, Text } from "@mantine/core";
import { DeleteQuoteButton } from "@/components/bd-tool/delete-quote-button";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { BriefcaseBusiness } from "lucide-react";
import { CompanyMark } from "@/components/leadely/company-mark";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkButton, LinkIcon } from "@/components/mantine-link";
import { loadWorkspaceAppData } from "@/lib/db/actions";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import { getTranslations } from "next-intl/server";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const t = await getTranslations("Quotes");
  const { q, page } = readListQuery(await searchParams);
  const { quotes, clients } = await loadWorkspaceAppData(["quotes", "clients"]);
  const matched = quotes.filter((quote) => {
    const client = clients.find((item) => item.id === quote.clientId);
    return matchesQuery(q, [quote.title, quote.publicId, client?.companyName, quote.quoteStatusV2, quote.status]);
  });
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Group gap="xs">
            <LinkButton href="/app/quotes/new?mode=upload" variant="default">
              {t("uploadPdf")}
            </LinkButton>
            <LinkButton href="/app/quotes/new">{t("newQuote")}</LinkButton>
          </Group>
        }
      />
      <SectionPanel
        title={t("allQuotes")}
        padded={paged.total === 0}
        action={<ListSearch path="/app/quotes" q={q} placeholder={t("searchPlaceholder")} />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/quotes" q={q} {...paged} singular={t("item")} plural={t("items")} />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>{t("quote")}</TableTh>
                <TableTh>{t("client")}</TableTh>
                <TableTh>{t("status")}</TableTh>
                <TableTh>{t("revision")}</TableTh>
                <TableTh ta="right">{t("value")}</TableTh>
                <TableTh w={72} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((quote) => {
                const client = clients.find((item) => item.id === quote.clientId);
                return (
                  <TableTr key={quote.id}>
                    <TableTd>
                      <Text fw={600} size="sm">
                        {quote.title || t("untitled")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {quote.publicId}
                      </Text>
                    </TableTd>
                    <TableTd>
                      <CompanyMark name={client?.companyName || "—"} logo={client?.logoUrl} />
                    </TableTd>
                    <TableTd>
                      <StatusBadge status={quote.quoteStatusV2 || quote.status} />
                    </TableTd>
                    <TableTd>{quote.revisionNumber || 1}</TableTd>
                    <TableTd ta="right">{formatVnd(calculateQuoteTotals(quote).grandTotal)}</TableTd>
                    <TableTd ta="right">
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <DeleteQuoteButton quoteId={quote.id} label={quote.title || quote.publicId} appearance="icon" />
                        <LinkIcon href={`/app/quotes/${quote.id}`} label={t("openQuote", { name: quote.title || quote.publicId })} />
                      </Group>
                    </TableTd>
                  </TableTr>
                );
              })}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">{t("noMatches")}</Text>
        ) : (
          <EmptyState icon={<BriefcaseBusiness size={18} />} title={t("emptyTitle")} description={t("emptyDescription")} />
        )}
      </SectionPanel>
    </Stack>
  );
}
