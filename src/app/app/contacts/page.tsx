import { requireModule } from "@/lib/auth/session";
import { Box, Button, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { Users } from "lucide-react";
import { CompanyMark } from "@/components/leadely/company-mark";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkAnchor, LinkButton, LinkIcon } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { createContactAction, listCompanies, listContactsPage } from "@/features/companies/server/actions";
import { RELATIONSHIP_STRENGTHS } from "@/lib/crm";
import classes from "@/styles/leadely-dashboard.module.css";
import { getTranslations } from "next-intl/server";

const PAGE_SIZE = 20;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireModule("contacts");
  const t = await getTranslations("CRM");
  const params = await searchParams;
  const q = (params.q || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const [{ rows, total, page }, companies] = await Promise.all([
    listContactsPage({ query: q, page: requestedPage, pageSize: PAGE_SIZE }),
    listCompanies(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <Stack gap="md">
      <PageHeader title={t("contactsTitle")} subtitle={t("contactsSubtitle")} />
      <SectionPanel title={t("addContact")}>
        <ActionForm action={createContactAction} submitLabel={t("createContact")} redirectTo="/app/contacts/{id}">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="first_name" label={t("firstName")} />
            <TextInput name="last_name" label={t("lastName")} />
            <TextInput name="display_name" label={t("displayName")} style={{ gridColumn: "1 / -1" }} />
            <TextInput name="email" label={t("email")} />
            <TextInput name="phone" label={t("phone")} />
            <TextInput name="job_title" label={t("jobTitle")} />
            <TextInput name="linkedin_url" label={t("linkedin")} />
            <NativeSelect
              name="company_id"
              label={t("company")}
              data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <NativeSelect
              name="relationship_strength"
              label={t("relationship")}
              data={RELATIONSHIP_STRENGTHS.map((item) => ({ value: item, label: item }))}
            />
          </SimpleGrid>
          <Textarea name="notes" label={t("notes")} />
        </ActionForm>
      </SectionPanel>
      <div data-tutorial-id="contacts-list">
      <SectionPanel title={t("allContacts")} padded={rows.length === 0} action={<ContactSearch q={q} />}>
        {rows.length ? (
          <>
            <Box className={classes.scrollTable}>
              <Table>
                <TableThead>
                  <TableTr>
                    <TableTh>{t("person")}</TableTh>
                    <TableTh>{t("company")}</TableTh>
                    <TableTh>{t("jobTitle")}</TableTh>
                    <TableTh>{t("phone")}</TableTh>
                    <TableTh w={48} />
                  </TableTr>
                </TableThead>
                <TableTbody>
                  {rows.map((contact, index) => (
                    <TableTr key={contact.id}>
                      <TableTd>
                        <Text fw={600} size="sm" lineClamp={1}>
                          {contact.display_name}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {contact.email}
                        </Text>
                      </TableTd>
                      <TableTd>
                        <CompanyMark name={contact.companies?.name || "—"} logo={contact.companies?.logo_path} />
                      </TableTd>
                      <TableTd>
                        <Text size="sm" lineClamp={1}>
                          {contact.job_title || "—"}
                        </Text>
                      </TableTd>
                      <TableTd>
                        <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                          {contact.phone || "—"}
                        </Text>
                      </TableTd>
                      <TableTd ta="right">
                        <span data-tutorial-id={index === 0 ? "tutorial-open-first-contact" : undefined}>
                          <LinkIcon href={`/app/contacts/${contact.id}`} label={t("openRecord", { name: contact.display_name })} />
                        </span>
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
              {pageCount > 1 ? <ContactPager q={q} page={page} pageCount={pageCount} /> : null}
            </Group>
          </>
        ) : q ? (
          <Text size="sm" c="dimmed">
            {t("noContactMatches")}
          </Text>
        ) : (
          <EmptyState icon={<Users size={18} />} title={t("noContacts")} description={t("noContactsHelp")} />
        )}
      </SectionPanel>
      </div>
    </Stack>
  );
}

async function ContactSearch({ q }: { q: string }) {
  const t = await getTranslations("CRM");
  return (
    <form action="/app/contacts">
      <Group gap="xs" wrap="nowrap">
        <TextInput name="q" defaultValue={q} placeholder={t("contactSearch")} aria-label={t("contactSearch")} w={300} />
        <Button type="submit" variant="light">
          {t("search")}
        </Button>
        {q ? (
          <LinkAnchor href="/app/contacts" size="sm">
            {t("clear")}
          </LinkAnchor>
        ) : null}
      </Group>
    </form>
  );
}

function ContactPager({ q, page, pageCount }: { q: string; page: number; pageCount: number }) {
  return (
    <Group gap={4} wrap="nowrap">
      {pageLinks(page, pageCount).map((item, index) =>
        item === "…" ? (
          <Text key={`gap-${index}`} size="sm" c="dimmed" px={4}>
            …
          </Text>
        ) : (
          <LinkButton key={item} href={contactsHref(q, item)} size="compact-sm" variant={item === page ? "filled" : "subtle"} color={item === page ? "leadely" : "gray"}>
            {item}
          </LinkButton>
        ),
      )}
    </Group>
  );
}

function contactsHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/app/contacts?${search}` : "/app/contacts";
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
