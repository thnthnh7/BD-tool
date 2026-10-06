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
import { getActorInputDraft } from "@/features/leads/server/actor-drafts";
import { getOrCreateActorGuide } from "@/features/leads/server/actor-guide-cache";
import { getLocale } from "next-intl/server";

export default async function NewScrapePage({ searchParams }: { searchParams: Promise<{ source?: string; rerun?: string; draft?: string; example?: string }> }) {
  await requireModule("scraping");
  const params = await searchParams;
  const t = await getTranslations("Scrape");
  const locale = await getLocale();
  const context = await requireWorkspace();
  const [sources, apify, previous, actorDraft] = await Promise.all([
    listInstalledSources(),
    getCurrentWorkspaceApifyStatus(),
    params.rerun ? getScrapeInput(params.rerun) : null,
    getActorInputDraft(params.draft),
  ]);
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
    {sources.length ? <SourceChooser sources={sources} selectedId={selected?.id || ""} /> : <SectionPanel><EmptyState icon={<Radar size={20} />} title={t("noSources")} description={t("noSourcesHelp")} /></SectionPanel>}
    <Suspense key={`${selected?.id}-${reuse?.id || actorDraft?.id || params.example || "new"}`} fallback={<Skeleton height={260} radius="md" />}><SelectedActor selected={selected} reuse={reuse} actorDraft={actorDraft} draftRequested={Boolean(params.draft)} useExample={params.example === "1"} locale={locale} workspaceId={context.workspaceId} enabled={Boolean(context.plan.features.lead_scrape)} connected={apify.connection?.status === "active"} canManage={context.memberRole !== "member"} /></Suspense>
    {selected && <Group><Text size="xs" c="dimmed">{t("storageNote")}</Text></Group>}
  </Stack>;
}

function describeApifyConnectionError(error: unknown, t: Awaited<ReturnType<typeof getTranslations>>) {
  const message = error instanceof Error ? error.message : "";
  if (/authenticate data|Unsupported state|authentication tag|bad decrypt|WORKSPACE_SECRETS_KEY|SUPABASE_SERVICE_ROLE_KEY/i.test(message)) return t("tokenUnreadable");
  if (/xác thực lại|hết hạn|expired/i.test(message)) return t("reconnectApify");
  return message || t("connectFirst");
}

async function SelectedActor({ selected, reuse, actorDraft, draftRequested, useExample, locale, workspaceId, enabled, connected, canManage }: {
  selected: Awaited<ReturnType<typeof listInstalledSources>>[number] | undefined;
  reuse: NonNullable<Awaited<ReturnType<typeof getScrapeInput>>>["job"] | null;
  actorDraft: Awaited<ReturnType<typeof getActorInputDraft>>;
  draftRequested: boolean;
  useExample: boolean;
  locale: string;
  workspaceId: string;
  enabled: boolean;
  connected: boolean;
  canManage: boolean;
}) {
  const t = await getTranslations("Scrape");
  const maps = selected && isMapsActor(selected.slug);
  if (!selected) return null;
  // Showing the Maps form needs connection status only. The submit action
  // resolves and validates credentials again when the user actually starts a run.
  let connectionError: string | null = null;
  let apifyCredential: Awaited<ReturnType<typeof requireWorkspaceApifyConnection>> | null = null;
  if (enabled && connected && !maps) {
    try {
      apifyCredential = await requireWorkspaceApifyConnection(workspaceId);
    } catch (error) {
      connectionError = describeApifyConnectionError(error, t);
    }
  }
  const canUseConnection = connected && (maps || Boolean(apifyCredential));
  const contract = !maps && enabled && apifyCredential ? await ensureSourceContract(selected.id, apifyCredential.token) : null;
  const generatedGuide = contract?.contractHash ? await getOrCreateActorGuide({
    sourceId: selected.id,
    contractHash: contract.contractHash,
    locale,
    schema: contract.inputSchema,
    example: contract.exampleInput,
    readmeMarkdown: contract.readmeMarkdown || "",
  }).catch(() => null) : null;
  const draftInput = contract?.contractHash && actorDraft?.source_id === selected.id && actorDraft.contract_hash === contract.contractHash ? actorDraft.input : null;
  const initialInput = draftInput || reuse?.filters || (useExample ? contract?.exampleInput : null) || null;
  const draftUnavailable = draftRequested && !draftInput;

  return <SectionPanel title={selected.title} action={<Badge color={maps ? "teal" : "gray"}>{maps ? t("crmSupported") : t("datasetOnly")}</Badge>}>
      {draftUnavailable ? <Alert color="yellow">This AI draft expired or was created for an older Actor definition. Ask the Agent to prepare a new draft.</Alert> : null}
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
      </ActionForm> : enabled && canUseConnection && contract?.inputSchema ? <ActorInputForm
        key={`${selected.id}-${reuse?.id || "new"}`}
        sourceId={selected.id}
        sourceSlug={selected.slug}
        schema={contract.inputSchema}
        initialInput={initialInput}
        exampleAvailable={Boolean(contract.exampleInput)}
        readmeMarkdown={contract.readmeMarkdown}
        buildNumber={contract.buildNumber}
        contractHash={contract.contractHash}
        fetchedAt={contract.fetchedAt}
        stale={contract.stale}
        canManage={canManage}
        draftApplied={Boolean(draftInput)}
        pricingModel={selected.pricing_model}
        structuredGuide={generatedGuide?.guide}
      /> : connectionError ? <Alert color="yellow">{connectionError}</Alert> : <Text size="sm" c="dimmed">{!canUseConnection ? (!enabled ? t("planUnavailable") : t("connectFirst")) : contract?.error || t("notReady")}</Text>}
    </SectionPanel>;
}
