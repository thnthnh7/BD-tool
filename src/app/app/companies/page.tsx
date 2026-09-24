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

const PAGE_SIZE = 20;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const { rows, total, page } = await listCompaniesPage({ query: q, page: requestedPage, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <Stack gap="md">
      <PageHeader title="Companies" subtitle="Tổ chức workspace đang phát triển quan hệ." />
      <SectionPanel title="Add company">
        <ActionForm action={createCompanyAction} submitLabel="Create company" redirectTo="/app/companies/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="name" label="Name" required style={{ gridColumn: "1 / -1" }} />
            <div style={{ gridColumn: "1 / -1" }}>
              <LogoField />
            </div>
            <TextInput name="industry" label="Industry" />
            <NativeSelect
              name="lifecycle_stage"
              label="Lifecycle"
              data={LIFECYCLE_STAGES.map((item) => ({ value: item, label: item }))}
            />
            <TextInput name="website" label="Website" />
            <TextInput name="domain" label="Domain" />
            <TextInput name="email" label="Email" />
            <TextInput name="phone" label="Phone" />
            <TextInput name="tax_code" label="Tax code" />
            <TextInput name="lead_source" label="Source" />
            <TextInput name="address" label="Address" style={{ gridColumn: "1 / -1" }} />
          </SimpleGrid>
          <Textarea name="notes" label="Notes" />
        </ActionForm>
      </SectionPanel>
      <SectionPanel title="All companies" padded={rows.length === 0} action={<CompanySearch q={q} />}>
        {rows.length ? (
          <>
            <Box className={classes.scrollTable}>
              <Table>
                <TableThead>
                  <TableTr>
                    <TableTh>Company</TableTh>
                    <TableTh>Industry</TableTh>
                    <TableTh>Lifecycle</TableTh>
                    <TableTh>Source</TableTh>
                    <TableTh>Email</TableTh>
                    <TableTh>Phone</TableTh>
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
                        <LinkIcon href={`/app/companies/${company.id}`} label={`Open ${company.name}`} />
                      </TableTd>
                    </TableTr>
                  ))}
                </TableTbody>
              </Table>
            </Box>
            <Group justify="space-between" px="md" py="sm">
              <Text size="sm" c="dimmed">
                {pageCount > 1 ? `${from}–${to} của ${total}` : `${total} compan${total === 1 ? "y" : "ies"}`}
              </Text>
              {pageCount > 1 ? <CompanyPager q={q} page={page} pageCount={pageCount} /> : null}
            </Group>
          </>
        ) : q ? (
          <Text size="sm" c="dimmed">
            Không thấy company khớp.
          </Text>
        ) : (
          <EmptyState icon={<Building2 size={18} />} title="No companies" description="Tạo company đầu tiên để bắt đầu CRM." />
        )}
      </SectionPanel>
    </Stack>
  );
}

function CompanySearch({ q }: { q: string }) {
  return (
    <form action="/app/companies">
      <Group gap="xs" wrap="nowrap">
        <TextInput name="q" defaultValue={q} placeholder="Tên, website, email hoặc SĐT" aria-label="Tìm company" w={300} />
        <Button type="submit" variant="light">
          Search
        </Button>
        {q ? (
          <LinkAnchor href="/app/companies" size="sm">
            Xóa
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
