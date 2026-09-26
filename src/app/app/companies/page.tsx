import { Box, Button, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { Building2 } from "lucide-react";
import { CompanyMark } from "@/components/leadely/company-mark";
import { EmptyState } from "@/components/leadely/empty-state";
import { LogoField } from "@/components/leadely/logo-field";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkAnchor, LinkButton, LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { createCompanyAction, listCompaniesPage } from "@/features/companies/server/actions";
import { LIFECYCLE_STAGES } from "@/lib/crm";
import classes from "@/styles/leadely-dashboard.module.css";
import { getTranslations } from "next-intl/server";

const PAGE_SIZE = 20;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const t = await getTranslations("CRM");
  const params = await searchParams;
  const q = (params.q || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const { rows, total, page } = await listCompaniesPage({ query: q, page: requestedPage, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <Stack gap="md">
      <PageHeader title={t("companiesTitle")} subtitle={t("companiesSubtitle")} />
      <SectionPanel title={t("addCompany")}>
        <ActionForm action={createCompanyAction} submitLabel={t("createCompany")} redirectTo="/app/companies/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="name" label={t("name")} required style={{ gridColumn: "1 / -1" }} />
            <div style={{ gridColumn: "1 / -1" }}>
              <LogoField />
            </div>
            <TextInput name="industry" label={t("industry")} />
            <NativeSelect
              name="lifecycle_stage"
              label={t("lifecycle")}
              data={LIFECYCLE_STAGES.map((item) => ({ value: item, label: item }))}
            />
            <TextInput name="website" label={t("website")} />
            <TextInput name="domain" label={t("domain")} />
            <TextInput name="email" label={t("email")} />
            <TextInput name="phone" label={t("phone")} />
            <TextInput name="tax_code" label={t("taxCode")} />
            <TextInput name="lead_source" label={t("source")} />
            <TextInput name="address" label={t("address")} style={{ gridColumn: "1 / -1" }} />
          </SimpleGrid>
          <Textarea name="notes" label={t("notes")} />
        </ActionForm>
      </SectionPanel>
      <SectionPanel title={t("allCompanies")} padded={rows.length === 0} action={<CompanySearch q={q} />}>
        {rows.length ? (
          <>
            <Box className={classes.scrollTable}>
              <Table>
                <TableThead>
                  <TableTr>
                    <TableTh>{t("company")}</TableTh>
                    <TableTh>{t("industry")}</TableTh>
                    <TableTh>{t("lifecycle")}</TableTh>
                    <TableTh>{t("source")}</TableTh>
                    <TableTh>{t("email")}</TableTh>
                    <TableTh>{t("phone")}</TableTh>
                    <TableTh w={48} />
                  </TableTr>
                </TableThead>
                <TableTbody>
                  {rows.map((company) => (
                    <TableTr key={company.id}>
                      <TableTd>
                        <CompanyMark name={company.name} logo={company.logo_path} fw={600} />
                        <Text size="xs" c="dimmed" lineClamp={1} ml={36}>
                          {company.website || "—"}
                        </Text>
                      </TableTd>
                      <TableTd>
                        <Text size="sm" lineClamp={1}>
                          {company.industry || "—"}
                        </Text>
                      </TableTd>
                      <TableTd>
                        <StatusBadge status={company.lifecycle_stage} />
                      </TableTd>
                      <TableTd>{company.lead_source || "—"}</TableTd>
                      <TableTd>
                        <Text size="sm" lineClamp={1}>
                          {company.email || "—"}
                        </Text>
                      </TableTd>
                      <TableTd>
                        <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                          {company.phone || "—"}
                        </Text>
                      </TableTd>
                      <TableTd ta="right">
                        <LinkIcon href={`/app/companies/${company.id}`} label={t("openRecord", { name: company.name })} />
                      </TableTd>
                    </TableTr>
                  ))}
                </TableTbody>
              </Table>
            </Box>
            <Group justify="space-between" px="md" py="sm">
              <Text size="sm" c="dimmed">
                {pageCount > 1 ? t("results", { from, to, total }) : t("count", { count: total })}
              </Text>
              {pageCount > 1 ? <CompanyPager q={q} page={page} pageCount={pageCount} /> : null}
            </Group>
          </>
        ) : q ? (
          <Text size="sm" c="dimmed">
            {t("noCompanyMatches")}
          </Text>
        ) : (
          <EmptyState icon={<Building2 size={18} />} title={t("noCompanies")} description={t("noCompaniesHelp")} />
        )}
      </SectionPanel>
    </Stack>
  );
}

async function CompanySearch({ q }: { q: string }) {
  const t = await getTranslations("CRM");
  return (
    <form action="/app/companies">
      <Group gap="xs" wrap="nowrap">
        <TextInput name="q" defaultValue={q} placeholder={t("companySearch")} aria-label={t("companySearch")} w={300} />
        <Button type="submit" variant="light">
          {t("search")}
        </Button>
        {q ? (
          <LinkAnchor href="/app/companies" size="sm">
            {t("clear")}
          </LinkAnchor>
        ) : null}
      </Group>
    </form>
  );
}

function CompanyPager({ q, page, pageCount }: { q: string; page: number; pageCount: number }) {
  return (
    <Group gap={4} wrap="nowrap">
      {pageLinks(page, pageCount).map((item, index) =>
        item === "…" ? (
          <Text key={`gap-${index}`} size="sm" c="dimmed" px={4}>
            …
          </Text>
        ) : (
          <LinkButton key={item} href={companiesHref(q, item)} size="compact-sm" variant={item === page ? "filled" : "subtle"} color={item === page ? "leadely" : "gray"}>
            {item}
          </LinkButton>
        ),
      )}
    </Group>
  );
}

function companiesHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/app/companies?${search}` : "/app/companies";
}

function pageLinks(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const end = Math.min(total, Math.max(current + 2, 5));
  const start = Math.max(1, end - 4);
  const items: Array<number | "…"> = [];
  if (start > 1) items.push(1, "…");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total) items.push("…", total);
  return items;
}
