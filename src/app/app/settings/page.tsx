import { loadWorkspaceAppData } from "@/lib/db/actions";
import { SettingsPanel } from "@/components/bd-tool/settings-panel";
import { defaultSettings } from "@/lib/default-data";
import { NativeSelect, Text, TextInput } from "@mantine/core";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { deleteAiProviderAction, getDefaultAiProvider, saveAiProviderAction } from "@/features/ai/server/providers";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus } from "@/features/leads/server/apify-connection";

export default async function SettingsPage() {
  const { context, settings } = await loadWorkspaceAppData();
  const [ai, apify] = await Promise.all([getDefaultAiProvider(), getCurrentWorkspaceApifyStatus()]);
  const canManage = context.memberRole === "owner" || context.memberRole === "admin";

  return (
      <SettingsPanel
        initial={settings || defaultSettings}
        workspaceType={context.workspaceType}
        isOwner={context.memberRole === "owner"}
        apifyProvider={<ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} showSetup />}
        aiProvider={
      <SectionPanel title="AI provider (BYOK)">
        <Text size="sm" mb="md">Provider và model này được dùng chung cho toàn bộ chức năng AI của workspace, bao gồm AI Brief và phân tích Deal.</Text>
        <Text size="xs" c="dimmed" mb="md">Khi chưa cấu hình hoặc provider riêng gặp lỗi, hệ thống sử dụng AI nền tảng nếu khả dụng và áp dụng quota AI của gói.</Text>
        {ai.canByok ? (
          canManage ? (
            <>
              {ai.provider ? (
                <Text size="sm" mb="sm">
                  Active: {ai.provider.provider} · {ai.provider.model} · {ai.provider.base_url} · {ai.provider.status}
                </Text>
              ) : (
                <Text size="sm" c="dimmed" mb="sm">
                  Chưa gắn key. Mặc định dùng 9Router (tính quota AI Brief).
                </Text>
              )}
              <ActionForm action={saveAiProviderAction} submitLabel="Test & save key">
                <NativeSelect
                  name="provider"
                  label="Provider"
                  defaultValue={ai.provider?.provider || "openai"}
                  data={["openai", "openrouter", "groq", "azure", "custom"].map((item) => ({ value: item, label: item }))}
                />
                <TextInput name="base_url" label="Base URL" placeholder="https://api.openai.com/v1" defaultValue={ai.provider?.base_url || ""} />
                <TextInput name="model" label="Model" placeholder="Tên model của provider" autoComplete="off" defaultValue={ai.provider?.model || ""} />
                <TextInput name="api_key" type="password" label="API key" placeholder="Nhập key mới để kiểm tra và lưu" autoComplete="new-password" />
              </ActionForm>
              {ai.provider ? (
                <ActionForm action={deleteAiProviderAction} submitLabel="Remove key">
                  <input type="hidden" name="confirm" value="1" />
                </ActionForm>
              ) : null}
            </>
          ) : (
            <Text size="sm">Chỉ owner/admin được gắn API key.</Text>
          )
        ) : (
          <Text size="sm" c="dimmed">
            Gói Free không được BYOK. Nâng gói để dùng OpenAI-compatible key riêng (không trừ quota ai_briefs).
          </Text>
        )}
      </SectionPanel>
        }
      />
  );
}
