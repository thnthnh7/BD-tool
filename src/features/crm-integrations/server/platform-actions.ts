"use server";

import { revalidatePath } from "next/cache";
import { crmProviderIds, crmProviders } from "@/features/crm-integrations/catalog";
import { requirePlatform } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recordPlatformAudit } from "@/lib/platform/audit";

const rolloutStatuses = new Set(["not_configured", "testing", "available", "maintenance"]);

export async function loadPlatformCrmIntegrations() {
  const context = await requirePlatform();
  const supabase = await createClient();
  const [{ data: configs }, { data: connections }] = await Promise.all([
    supabase.from("crm_provider_configs").select("*").order("provider"),
    supabase.from("crm_connections").select("provider, status"),
  ]);
  const counts = new Map<string, { total: number; connected: number }>();
  for (const connection of connections || []) {
    const current = counts.get(connection.provider) || { total: 0, connected: 0 };
    current.total += 1;
    if (connection.status === "connected") current.connected += 1;
    counts.set(connection.provider, current);
  }
  const configByProvider = new Map((configs || []).map((config) => [config.provider, config]));
  return {
    canMutate: context.platformRole === "super_admin",
    providers: crmProviders.map((provider) => ({
      ...provider,
      config: configByProvider.get(provider.id) || null,
      credentialsReady: provider.credentials.length === 0 || Boolean(
        (configByProvider.get(provider.id)?.client_id_secret_id && configByProvider.get(provider.id)?.client_secret_secret_id)
        || provider.credentials.every((key) => Boolean(process.env[key])),
      ),
      credentialSource: configByProvider.get(provider.id)?.client_id_secret_id && configByProvider.get(provider.id)?.client_secret_secret_id ? "vault" : provider.credentials.every((key) => Boolean(process.env[key])) ? "environment" : null,
      missingCredentials: provider.credentials.filter((key) => !process.env[key]),
      usage: counts.get(provider.id) || { total: 0, connected: 0 },
    })),
  };
}

export async function updateCrmProviderConfigAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const provider = String(formData.get("provider") || "");
  const rolloutStatus = String(formData.get("rollout_status") || "");
  const enabled = formData.get("enabled") === "on";
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000);
  if (!crmProviderIds.has(provider)) return;
  if (!rolloutStatuses.has(rolloutStatus)) return;
  const definition = crmProviders.find((item) => item.id === provider);
  const supabase = await createClient();
  const clientId = String(formData.get("client_id") || "").trim();
  const clientSecret = String(formData.get("client_secret") || "").trim();
  if (definition?.credentials.length && (clientId || clientSecret)) {
    const { error: credentialError } = await supabase.rpc("set_crm_provider_credentials", {
      p_provider: provider,
      p_client_id: clientId || null,
      p_client_secret: clientSecret || null,
    });
    if (credentialError) throw new Error(credentialError.message);
  }
  const { data: savedConfig } = await supabase.from("crm_provider_configs").select("client_id_secret_id, client_secret_secret_id").eq("provider", provider).single();
  const credentialsReady = definition?.credentials.length === 0 || Boolean(
    (savedConfig?.client_id_secret_id && savedConfig.client_secret_secret_id)
    || definition?.credentials.every((key) => Boolean(process.env[key])),
  );
  if (enabled && !credentialsReady) return;
  await supabase.from("crm_provider_configs").upsert({
    provider,
    enabled,
    rollout_status: rolloutStatus,
    notes,
    updated_by: context.userId,
  }, { onConflict: "provider" });
  await recordPlatformAudit({
    action: "crm_provider.update",
    entityType: "crm_provider",
    entityId: null,
    after: { provider, enabled, rolloutStatus, credentialsChanged: Boolean(clientId || clientSecret) },
  });
  revalidatePath("/app/platform/crm-integrations");
  revalidatePath("/app/crm-integrations");
}
