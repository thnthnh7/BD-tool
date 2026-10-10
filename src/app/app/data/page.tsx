import Form from "next/form";
import { Button, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/leadely/page-header";
import { ListFooter } from "@/components/leadely/list-frame";
import { DataLibraryBrowser } from "@/features/data-library/components/data-library-browser";
import { listDataLibrary } from "@/features/data-library/server/actions";
import { DATA_RECORD_TYPES } from "@/features/data-library/normalize";
import { requireModule } from "@/lib/auth/session";

export default async function DataLibraryPage({ searchParams }: {
  searchParams: Promise<{ q?: string; type?: string; collection?: string; status?: string; quality?: string; page?: string }>;
}) {
  await requireModule("data_library");
  const [params, t, common, locale] = await Promise.all([searchParams, getTranslations("DataLibrary"), getTranslations("Common"), getLocale()]);
  const page = Math.max(1, Number(params.page) || 1);
  const quality = [50, 70, 90].includes(Number(params.quality)) ? Number(params.quality) : 0;
  const payload = await listDataLibrary({
    q: params.q || "", type: params.type || "", collectionId: params.collection || "",
    status: params.status || "", minQuality: quality, page,
  });
  const pageCount = Math.max(1, Math.ceil(payload.total / payload.pageSize));
  const extra = { type: params.type || "", collection: params.collection || "", status: params.status || "", quality: quality ? String(quality) : "" };
  const labels = {
    allCollections: t("allCollections"), collections: t("collections"), records: t("records"), dataType: t("dataType"),
    details: t("details"), rawData: t("rawData"), open: t("open"), createCompany: t("createCompany"),
    createContact: t("createContact"), saved: t("saved"), unknownCollection: t("unknownCollection"), quality: t("quality"),
    status: t("status"), source: t("source"), issues: t("issues"), duplicate: t("duplicate"), suppress: t("suppress"), restore: t("restore"),
    importSelected: t("importSelected"), previewTitle: t("previewTitle"), selectedCount: t("selectedCount"), target: t("target"),
    companies: t("companies"), contacts: t("contacts"), duplicatePolicy: t("duplicatePolicy"), skipExisting: t("skipExisting"),
    updateExisting: t("updateExisting"), runImport: t("runImport"), cancel: t("cancel"), imported: t("imported"), updated: t("updated"), skipped: t("skipped"), failed: t("failed"),
  };
  const typeLabels = Object.fromEntries(DATA_RECORD_TYPES.map((type) => [type, t(`types.${type}`)]));
  return <Stack gap="md">
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <Form action="/app/data">
      <Group gap="sm" align="flex-end">
        <TextInput name="q" defaultValue={params.q || ""} placeholder={t("search")} aria-label={t("search")} style={{ flex: 1, minWidth: 220 }} />
        <NativeSelect name="type" defaultValue={params.type || ""} aria-label={t("dataType")} data={[{ value: "", label: t("allTypes") }, ...DATA_RECORD_TYPES.map((type) => ({ value: type, label: typeLabels[type] }))]} />
        <NativeSelect name="status" defaultValue={params.status || ""} aria-label={t("status")} data={[{ value: "", label: t("allStatuses") }, ...["pending", "ready", "duplicate", "suppressed", "imported"].map((value) => ({ value, label: t(`statuses.${value}`) }))]} />
        <NativeSelect name="quality" defaultValue={quality ? String(quality) : ""} aria-label={t("quality")} data={[{ value: "", label: t("anyQuality") }, ...[50, 70, 90].map((value) => ({ value: String(value), label: `${value}%+` }))]} />
        <Button type="submit" variant="light">{t("filter")}</Button>
      </Group>
    </Form>
    <DataLibraryBrowser records={payload.records} collections={payload.collections} selectedCollection={params.collection || ""} total={payload.total} locale={locale}
      labels={labels} typeLabels={typeLabels}
      footer={<ListFooter path="/app/data" q={params.q || ""} page={payload.page} pageCount={pageCount} from={payload.total ? (payload.page - 1) * payload.pageSize + 1 : 0} to={Math.min(payload.page * payload.pageSize, payload.total)} total={payload.total} singular={t("record")} plural={t("records")} ofLabel={common("of")} extra={extra} />} />
  </Stack>;
}
