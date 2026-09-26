import { loadWorkspaceAppData } from "@/lib/db/actions";
import { SettingsPanel } from "@/components/bd-tool/settings-panel";
import { defaultSettings } from "@/lib/default-data";
import { NativeSelect, Text, TextInput } from "@mantine/core";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { deleteAiProviderAction, getDefaultAiProvider, saveAiProviderAction } from "@/features/ai/server/providers";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";
import { LocaleSettings } from "@/features/settings/components/locale-settings";
import { getTranslations } from "next-intl/server";

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
              <ActionForm action={saveAiProviderAction} submitLabel={t("testSaveKey")}>
                <NativeSelect
                  name="provider"
                  label={t("provider")}
                  defaultValue={ai.provider?.provider || "openai"}
                  data={["openai", "openrouter", "groq", "azure", "custom"].map((item) => ({ value: item, label: item }))}
                />
                <TextInput name="base_url" label="Base URL" placeholder="https://api.openai.com/v1" defaultValue={ai.provider?.base_url || ""} />
                <TextInput name="model" label={t("model")} placeholder={t("modelPlaceholder")} autoComplete="off" defaultValue={ai.provider?.model || ""} />
                <TextInput name="api_key" type="password" label="API key" placeholder={t("apiKeyPlaceholder")} autoComplete="new-password" />
              </ActionForm>
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
      </SectionPanel>
        }
      />
  );
}
