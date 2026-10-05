import { Suspense } from "react";
import { Alert, Badge, Checkbox, Group, SimpleGrid, Skeleton, Stack, Text, TextInput } from "@mantine/core";
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
import { startMapsScrapeAction } from "@/features/leads/server/scrape-actions";
import { getScrapeInput } from "@/features/leads/server/scrape-input";
import { isMapsActor } from "@/features/leads/maps-source";
import { requireWorkspace, requireModule } from "@/lib/auth/session";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus, requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";
import { getTranslations } from "next-intl/server";

export default async function NewScrapePage({ searchParams }: { searchParams: Promise<{ source?: string; rerun?: string }> }) {
  await requireModule("scraping");
  const params = await searchParams;
  const t = await getTranslations("Scrape");
  const context = await requireWorkspace();
  const [sources, apify, previous] = await Promise.all([listInstalledSources(), getCurrentWorkspaceApifyStatus(), params.rerun ? getScrapeInput(params.rerun) : null]);
  const previousSource = previous && sources.find((source) => source.id === previous.job.source_id ||
    source.slug === previous.job.apify_actor_id.replaceAll("~", "/") || (isMapsActor(source.slug) && previous.job.apify_actor_id === "demo"));
  const requestedId = params.source || previousSource?.id;
  const selected = sources.find((source) => source.id === requestedId) || sources[0];
  const rerunUnavailable = Boolean(params.rerun && !previousSource);
  const reuse = previous && !rerunUnavailable && selected?.id === previousSource?.id ? previous.job : null;


  return <Stack gap="md" w="100%" style={{ minWidth: 0 }}>
    <PageHeader back={{ href: "/app/leads/scrape", label: t("historyBack") }} title={reuse ? t("rerunTitle") : t("newTitle")} subtitle={t("newSubtitle")} action={<LinkButton href="/app/leads/sources" variant="default">{t("addSource")}</LinkButton>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact />
    {rerunUnavailable && <Alert color="yellow">{t("oldSourceUnavailable")}</Alert>}
    {!context.plan.features.lead_scrape && <Alert color="yellow">{t("planUnavailable")}</Alert>}
    {sources.length ? <SectionPanel><SourceChooser sources={sources} selectedId={selected?.id || ""} /></SectionPanel> : <SectionPanel><EmptyState icon={<Radar size={20} />} title={t("noSources")} description={t("noSourcesHelp")} /></SectionPanel>}
    <Suspense key={`${selected?.id}-${reuse?.id || "new"}`} fallback={<Skeleton height={260} radius="md" />}><SelectedActor selected={selected} reuse={reuse} workspaceId={context.workspaceId} enabled={Boolean(context.plan.features.lead_scrape)} connected={apify.connection?.status === "active"} /></Suspense>
    {selected && <Group><Text size="xs" c="dimmed">{t("storageNote")}</Text></Group>}
  </Stack>;
}

async function SelectedActor({ selected, reuse, workspaceId, enabled, connected }: {
  selected: Awaited<ReturnType<typeof listInstalledSources>>[number] | undefined;
  reuse: NonNullable<Awaited<ReturnType<typeof getScrapeInput>>>["job"] | null;
  workspaceId: string;
  enabled: boolean;
  connected: boolean;
}) {
  const t = await getTranslations("Scrape");
  const maps = selected && isMapsActor(selected.slug);
  if (!selected) return null;
  // Showing the Maps form needs connection status only. The submit action
  // resolves and validates credentials again when the user actually starts a run.
  const apifyCredential = enabled && connected && !maps ? await requireWorkspaceApifyConnection(workspaceId).catch(() => null) : null;
  const canUseConnection = connected && (maps || Boolean(apifyCredential));
  const contract = !maps && enabled && apifyCredential ? await ensureSourceContract(selected.id, apifyCredential.token) : null;

  return <SectionPanel title={selected.title} action={<Badge color={maps ? "teal" : "gray"}>{maps ? t("crmSupported") : t("datasetOnly")}</Badge>}>
      {enabled && canUseConnection && maps && selected.adapter_status === "ready" ? <ActionForm key={`${selected.id}-${reuse?.id || "new"}`} action={startMapsScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
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
      </ActionForm> : enabled && canUseConnection && contract?.inputSchema ? <ActorInputForm key={`${selected.id}-${reuse?.id || "new"}`} sourceId={selected.id} schema={contract.inputSchema} example={reuse?.filters || contract.exampleInput} /> : <Text size="sm" c="dimmed">{!canUseConnection ? t("connectFirst") : contract?.error || t("notReady")}</Text>}
    </SectionPanel>;
}
