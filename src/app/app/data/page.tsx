import { requireModule } from "@/lib/auth/session";
import { Button, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { Database, Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/leadely/page-header";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter } from "@/components/leadely/list-frame";
import { DATA_RECORD_TYPES } from "@/features/data-library/normalize";
import { listDataLibrary } from "@/features/data-library/server/actions";
import { DataLibraryBrowser } from "@/features/data-library/components/data-library-browser";

export default async function DataLibraryPage({ searchParams }: {
  searchParams: Promise<{ q?: string; type?: string; collection?: string; page?: string }>;
}) {
  await requireModule("data_library");
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("DataLibrary"), getLocale()]);
  const q = params.q?.trim() || "";
  const type = DATA_RECORD_TYPES.includes(params.type as (typeof DATA_RECORD_TYPES)[number]) ? params.type || "" : "";
  const collectionId = params.collection || "";
  const page = Math.max(1, Number(params.page) || 1);
  const payload = await listDataLibrary({ q, type, collectionId, page });
  const extra = { q, type, collection: collectionId };
  const typeLabels = Object.fromEntries(DATA_RECORD_TYPES.map((item) => [item, t(`types.${item}`)]));
  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <form action="/app/data">
      <Group gap="sm" wrap="wrap">
        <TextInput name="q" defaultValue={q} placeholder={t("search")} leftSection={<Search size={15} />} style={{ flex: "1 1 260px" }} />
        <NativeSelect name="type" defaultValue={type} data={[{ value: "", label: t("allTypes") }, ...DATA_RECORD_TYPES.map((item) => ({ value: item, label: t(`types.${item}`) }))]} />
        {collectionId ? <input type="hidden" name="collection" value={collectionId} /> : null}
        <Button type="submit" variant="light">{t("filter")}</Button>
      </Group>
    </form>
    {payload.records.length === 0 ? <EmptyState icon={<Database size={18} />} title={t("emptyTitle")} description={t("emptyDescription")} /> : <DataLibraryBrowser
      records={payload.records} collections={payload.collections} selectedCollection={collectionId} total={payload.total} locale={locale} typeLabels={typeLabels}
      labels={{ allCollections: t("allCollections"), collections: t("collections"), records: t("records"), dataType: t("dataType"), details: t("details"), rawData: t("rawData"), open: t("open"), createCompany: t("createCompany"), createContact: t("createContact"), saved: t("saved"), unknownCollection: t("unknownCollection") }}
      footer={<ListFooter path="/app/data" q={q} from={(payload.page - 1) * payload.pageSize + 1}
        to={(payload.page - 1) * payload.pageSize + payload.records.length} total={payload.total}
        page={payload.page} pageCount={Math.max(1, Math.ceil(payload.total / payload.pageSize))}
        singular={t("record")} plural={t("records")} extra={extra} />} />}
  </Stack>;
}
