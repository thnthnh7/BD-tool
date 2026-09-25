import { Alert, Badge, Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { EmptyState } from "@/components/leadely/empty-state";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActorInputForm } from "@/features/leads/components/actor-input-form";
import { SourceChooser } from "@/features/leads/components/source-chooser";
import { ensureSourceContract } from "@/features/leads/server/actor-schema";
import { listInstalledSources } from "@/features/leads/server/source-actions";
import { getScrapeJob, startMapsScrapeAction } from "@/features/leads/server/scrape-actions";
import { isMapsActor } from "@/features/leads/maps-source";
import { requireWorkspace } from "@/lib/auth/session";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus, requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";
import { getTranslations } from "next-intl/server";

export default async function NewScrapePage({ searchParams }: { searchParams: Promise<{ source?: string; rerun?: string }> }) {
  const params = await searchParams;
  const t = await getTranslations("Scrape");
  const context = await requireWorkspace();
  const [sources, apify] = await Promise.all([listInstalledSources(), getCurrentWorkspaceApifyStatus()]);
  const previous = params.rerun ? await getScrapeJob(params.rerun) : null;
  const previousSource = previous && sources.find((source) => source.id === previous.job.source_id ||
    source.slug === previous.job.apify_actor_id.replaceAll("~", "/") || (isMapsActor(source.slug) && previous.job.apify_actor_id === "demo"));
  const requestedId = params.source || previousSource?.id;
  const selected = sources.find((source) => source.id === requestedId) || sources[0];
  const rerunUnavailable = Boolean(params.rerun && !previousSource);
  const maps = selected && isMapsActor(selected.slug);
  const reuse = previous && !rerunUnavailable && selected?.id === previousSource?.id ? previous.job : null;
  const apifyCredential = apify.connection?.status === "active" ? await requireWorkspaceApifyConnection(context.workspaceId).catch(() => null) : null;
  const contract = selected && !maps && context.plan.features.lead_scrape && apifyCredential ? await ensureSourceContract(selected.id, apifyCredential.token) : null;

  return <Stack gap="md" w="100%" style={{ minWidth: 0 }}>
    <PageHeader back={{ href: "/app/leads/scrape", label: t("historyBack") }} title={reuse ? t("rerunTitle") : t("newTitle")} subtitle={t("newSubtitle")} action={<LinkButton href="/app/leads/sources" variant="default">{t("addSource")}</LinkButton>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact />
    {rerunUnavailable && <Alert color="yellow">{t("oldSourceUnavailable")}</Alert>}
    {!context.plan.features.lead_scrape && <Alert color="yellow">{t("planUnavailable")}</Alert>}
    {sources.length ? <SectionPanel><SourceChooser sources={sources} selectedId={selected?.id || ""} /></SectionPanel> : <SectionPanel><EmptyState icon={<Radar size={20} />} title={t("noSources")} description={t("noSourcesHelp")} /></SectionPanel>}
    {selected && <SectionPanel title={selected.title} action={<Badge color={maps ? "teal" : "gray"}>{maps ? t("crmSupported") : t("datasetOnly")}</Badge>}>
      {context.plan.features.lead_scrape && apifyCredential && maps && selected.adapter_status === "ready" ? <ActionForm key={`${selected.id}-${reuse?.id || "new"}`} action={startMapsScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={{ base: "sm", md: "md" }}>
          <TextInput name="query" label={t("industry")} placeholder={t("industryPlaceholder")} required defaultValue={reuse?.query} />
          <TextInput name="location" label={t("location")} placeholder={t("locationPlaceholder")} required defaultValue={reuse?.location} />
          <TextInput name="language" label={t("language")} defaultValue={reuse?.language || "vi"} />
          <TextInput name="max_results" type="number" min={1} max={50} label={t("maxPlaces")} defaultValue={String(reuse?.max_results || 20)} />
          <TextInput name="max_people_per_place" type="number" min={0} max={5} label={t("maxContacts")} defaultValue={String(reuse?.max_people_per_place ?? 5)} />
        </SimpleGrid>
        <Checkbox name="enrich_people" label={t("enrich")} defaultChecked={reuse?.enrich_people ?? true} />
        <Checkbox name="verify_emails" label={t("verify")} defaultChecked={reuse?.verify_emails ?? false} />
        <Checkbox name="pdpa_confirmed" label={t("pdpa")} required />
      </ActionForm> : context.plan.features.lead_scrape && apifyCredential && contract?.inputSchema ? <ActorInputForm key={`${selected.id}-${reuse?.id || "new"}`} sourceId={selected.id} schema={contract.inputSchema} example={reuse?.filters || contract.exampleInput} /> : <Text size="sm" c="dimmed">{!apifyCredential ? t("connectFirst") : contract?.error || t("notReady")}</Text>}
    </SectionPanel>}
    {selected && <Group><Text size="xs" c="dimmed">{t("storageNote")}</Text></Group>}
  </Stack>;
}
