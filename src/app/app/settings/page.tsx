import { loadWorkspaceAppData } from "@/lib/db/actions";
import { SettingsPanel } from "@/components/bd-tool/settings-panel";
import { defaultSettings } from "@/lib/default-data";
import { Anchor, Table, Text } from "@mantine/core";
import Link from "next/link";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { deleteAiProviderAction, getDefaultAiProvider } from "@/features/ai/server/providers";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { LocaleSettings } from "@/features/settings/components/locale-settings";
import { getTranslations } from "next-intl/server";
import { AiProviderForm } from "@/features/ai/components/ai-provider-form";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const { context, settings } = await loadWorkspaceAppData(["settings"]);
  const [ai, apify] = await Promise.all([getDefaultAiProvider(), getCurrentWorkspaceApifyStatus()]);
  const canManage = context.memberRole === "owner" || context.memberRole === "admin";

  return (
      <SettingsPanel
        initial={settings || defaultSettings}
        workspaceType={context.workspaceType}
        isOwner={context.memberRole === "owner"}
        languageProvider={<LocaleSettings locale={context.locale} />}
        apifyProvider={<ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} showSetup />}
        aiProvider={
      <SectionPanel title={t("aiTitle")}>
        <Text size="sm" mb="md">{t("aiSharedHelp")}</Text>
        <Text size="xs" c="dimmed" mb="md">{t("aiFallbackHelp")}</Text>
        <Text size="xs" c={ai.platformConfigured ? "teal" : "orange"} mb="xs">
          Platform AI: {ai.platformConfigured ? "Ready" : "Not configured"}
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Shared AI usage this month: {ai.usage}/{ai.quota < 0 ? "Unlimited" : ai.quota}
        </Text>
        <Text size="xs" c={ai.readyKnowledge > 0 ? "teal" : "orange"} mb="md">
          Knowledge sources: {ai.readyKnowledge} ready · <Anchor component={Link} href="/app/modules">Manage knowledge</Anchor>
        </Text>
        {ai.canByok ? (
          canManage ? (
            <>
              {ai.provider ? (
                <Text size="sm" mb="sm">
                  {t("active")}: {ai.provider.provider} · {ai.provider.model} · {ai.provider.base_url} · {ai.provider.status}
                </Text>
              ) : (
                <Text size="sm" c="dimmed" mb="sm">
                  {t("noAiKey")}
                </Text>
              )}
              <AiProviderForm
                current={ai.provider}
                submitLabel={t("testSaveKey")}
                labels={{ provider: t("provider"), model: t("model"), apiKeyPlaceholder: t("apiKeyPlaceholder") }}
              />
              {ai.provider ? (
                <ActionForm action={deleteAiProviderAction} submitLabel={t("removeKey")}>
                  <input type="hidden" name="confirm" value="1" />
                </ActionForm>
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
            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr><Table.Th>User</Table.Th><Table.Th>Task</Table.Th><Table.Th>Source</Table.Th><Table.Th>Status</Table.Th><Table.Th>Latency</Table.Th><Table.Th>Tokens</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ai.recentActivity.map((event) => (
                    <Table.Tr key={`${event.created_at}-${event.actor_user_id || "system"}`}>
                      <Table.Td>{event.actor}</Table.Td>
                      <Table.Td>{event.operation.replaceAll("_", " ")}</Table.Td>
                      <Table.Td>{event.source === "byok" ? event.provider : "Platform"}</Table.Td>
                      <Table.Td><Text size="xs" c={event.status === "success" ? "teal" : "red"}>{event.status}</Text></Table.Td>
                      <Table.Td>{event.latency_ms} ms</Table.Td>
                      <Table.Td>{event.total_tokens ?? "—"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        ) : null}
      </SectionPanel>
        }
      />
  );
}
