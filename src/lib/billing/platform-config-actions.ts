"use server";

import { revalidatePath } from "next/cache";
import { encryptSecret } from "@/lib/crypto-utils";
import { requirePlatform } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPlatformAudit } from "@/lib/platform/audit";
import { getAllBillingProviderConfigs, type BillingProviderId } from "@/lib/billing/config";
import type { Json } from "@/lib/database.types";

const providerIds = new Set<BillingProviderId>(["stripe", "paypal", "sepay"]);
const credentialFields: Record<BillingProviderId, string[]> = {
  stripe: ["secretKey", "webhookSecret"],
  paypal: ["clientId", "clientSecret", "webhookId"],
  sepay: ["merchantId", "secretKey", "webhookSecret"],
};
const publicFields: Record<BillingProviderId, string[]> = {
  stripe: [],
  paypal: ["merchantEmail"],
  sepay: ["accountHolder", "bankAccount", "bankName", "bankBin"],
};

export async function loadBillingProviderAdminConfigs() {
  const context = await requirePlatform();
  const configs = await getAllBillingProviderConfigs();
  return {
    canMutate: context.platformRole === "super_admin",
    providers: configs.map((config) => ({
      provider: config.provider,
      enabled: config.enabled,
      mode: config.mode,
      accountLabel: config.accountLabel,
      source: config.source,
      public: config.public,
      configuredCredentials: Object.fromEntries(credentialFields[config.provider].map((key) => [key, Boolean(config.credentials[key])])),
    })),
  };
}

export async function updateBillingProviderConfigAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const provider = String(formData.get("provider") || "") as BillingProviderId;
  if (!providerIds.has(provider)) return;

  const admin = createAdminClient();
  const { data: existing } = await admin.from("billing_provider_configs").select("encrypted_credentials").eq("provider", provider).maybeSingle();
  const encryptedCredentials = { ...((existing?.encrypted_credentials || {}) as Record<string, unknown>) };
  const changed: string[] = [];
  for (const key of credentialFields[provider]) {
    const value = String(formData.get(key) || "").trim();
    if (!value) continue;
    encryptedCredentials[key] = encryptSecret(value);
    changed.push(key);
  }
  const publicConfig = Object.fromEntries(publicFields[provider].map((key) => [key, String(formData.get(key) || "").trim()]));
  const mode = String(formData.get("mode") || "test") === "live" ? "live" : "test";
  const accountLabel = String(formData.get("accountLabel") || "").trim().slice(0, 160);
  const enabled = formData.get("enabled") === "on";
  const { error } = await admin.from("billing_provider_configs").upsert({
    provider,
    enabled,
    mode,
    account_label: accountLabel,
    public_config: publicConfig,
    encrypted_credentials: encryptedCredentials as Json,
    updated_by: context.userId,
  }, { onConflict: "provider" });
  if (error) throw new Error(error.message);
  await recordPlatformAudit({ action: "billing_provider.update", entityType: "billing_provider", after: { provider, enabled, mode, accountLabel, credentialsChanged: changed } });
  revalidatePath("/app/platform/payments");
  revalidatePath("/app/platform/plans");
  revalidatePath("/app/billing");
}
