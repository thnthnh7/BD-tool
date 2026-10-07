import { loadWorkspaceAppData } from "@/lib/db/actions";
import { SettingsPanel } from "@/components/bd-tool/settings-panel";
import { defaultSettings } from "@/lib/default-data";
import { Divider, Text } from "@mantine/core";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { deleteAiProviderAction, getDefaultAiProvider } from "@/features/ai/server/providers";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { LocaleSettings } from "@/features/settings/components/locale-settings";
import { getTranslations } from "next-intl/server";
import { AiProviderForm } from "@/features/ai/components/ai-provider-form";
import { AiProviderOverview } from "@/features/ai/components/ai-provider-overview";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const t = await getTranslations("Settings");
  const params = await searchParams;
  const { context, settings } = await loadWorkspaceAppData(["settings"]);
  const supabase = await createClient();
  const { data: agentSettings } = await supabase.from("workspace_agent_settings").select("enabled, write_enabled").eq("workspace_id", context.workspaceId).maybeSingle();
  const [ai, apify] = await Promise.all([getDefaultAiProvider(), getCurrentWorkspaceApifyStatus()]);
  const canManage = context.memberRole === "owner" || context.memberRole === "admin";

  return (
      <SettingsPanel
        key={params.section || "language"}
        initial={settings || defaultSettings}
        workspaceType={context.workspaceType}
        isOwner={context.memberRole === "owner"}
        initialSection={params.section}
        languageProvider={<LocaleSettings locale={context.locale} />}
        apifyProvider={<div data-tutorial-id="settings-apify"><ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} showSetup /></div>}
        aiProvider={
      <SectionPanel title={t("aiTitle")}>
        <AiProviderOverview
          canManage={canManage}
          enabled={agentSettings?.enabled ?? true}
          writeEnabled={agentSettings?.write_enabled ?? false}
          readyKnowledge={ai.readyKnowledge}
          provider={ai.provider ? { provider: ai.provider.provider, model: ai.provider.model, status: ai.provider.status } : null}
        />
        <Divider my="md" />
        {ai.canByok ? (
          canManage ? (
            <>
              <AiProviderForm
                current={ai.provider}
                submitLabel={t("testSaveKey")}
                labels={{ provider: t("provider"), model: t("model"), apiKeyPlaceholder: t("apiKeyPlaceholder") }}
              />
              {ai.provider ? (
                <div style={{ marginTop: 12 }}>
                  <ActionForm action={deleteAiProviderAction} submitLabel={t("removeKey")} variant="light">
                    <input type="hidden" name="confirm" value="1" />
                  </ActionForm>
                </div>
              ) : null}
            </>
          ) : (
            <Text size="sm">{t("adminOnly")}</Text>
          )
        ) : (
          <Text size="sm" c="dimmed">
            {t("byokUnavailable")}
          </Text>
        )}
        {ai.recentActivity.length ? (
          <>
            <Text size="sm" fw={700} mt="xl" mb="xs">Recent AI activity</Text>
            <div style={{ overflowX: "auto" }}>
              <Table striped highlightOnHover withTableBorder style={{ minWidth: 720 }}>
                <TableThead>
                  <TableTr><TableTh>User</TableTh><TableTh>Task</TableTh><TableTh>Source</TableTh><TableTh>Status</TableTh><TableTh>Latency</TableTh><TableTh>Tokens</TableTh></TableTr>
                </TableThead>
                <TableTbody>
                  {ai.recentActivity.map((event) => (
                    <TableTr key={`${event.created_at}-${event.actor_user_id || "system"}`}>
                      <TableTd>{event.actor}</TableTd>
                      <TableTd>{event.operation.replaceAll("_", " ")}</TableTd>
                      <TableTd>{event.source === "byok" ? event.provider : "Platform"}</TableTd>
                      <TableTd><Text size="xs" c={event.status === "success" ? "teal" : "red"}>{event.status}</Text></TableTd>
                      <TableTd>{event.latency_ms} ms</TableTd>
                      <TableTd>{event.total_tokens ?? "—"}</TableTd>
                    </TableTr>
                  ))}
                </TableTbody>
              </Table>
            </div>
          </>
        ) : null}
      </SectionPanel>
        }
      />
  );
}
