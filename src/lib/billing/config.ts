import "server-only";

import { decryptSecret } from "@/lib/crypto-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingProviderId = "stripe" | "paypal" | "sepay";

type StoredConfig = {
  provider: BillingProviderId;
  enabled: boolean;
  mode: "test" | "live";
  account_label: string;
  public_config: Record<string, unknown> | null;
  encrypted_credentials: Record<string, unknown> | null;
};

export type BillingProviderRuntimeConfig = {
  provider: BillingProviderId;
  enabled: boolean;
  mode: "test" | "live";
  accountLabel: string;
  source: "database" | "environment" | null;
  public: Record<string, string>;
  credentials: Record<string, string>;
};

const providers: BillingProviderId[] = ["stripe", "paypal", "sepay"];

function strings(value: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(Object.entries(value || {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function decryptCredentials(value: Record<string, unknown> | null | undefined) {
  const result: Record<string, string> = {};
  for (const [key, encrypted] of Object.entries(value || {})) {
    if (typeof encrypted !== "string" || !encrypted) continue;
    try { result[key] = decryptSecret(encrypted); } catch { /* A rotated key leaves this credential unavailable. */ }
  }
  return result;
}

function environmentConfig(provider: BillingProviderId): BillingProviderRuntimeConfig {
  if (provider === "stripe") {
    const credentials = { secretKey: process.env.STRIPE_SECRET_KEY || "", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "" };
    const source = credentials.secretKey || credentials.webhookSecret ? "environment" as const : null;
    return { provider, enabled: Boolean(credentials.secretKey && credentials.webhookSecret), mode: credentials.secretKey.startsWith("sk_live_") ? "live" : "test", accountLabel: source ? "Stripe environment" : "", source, public: {}, credentials };
  }
  if (provider === "paypal") {
    const credentials = { clientId: process.env.PAYPAL_CLIENT_ID || "", clientSecret: process.env.PAYPAL_CLIENT_SECRET || "", webhookId: process.env.PAYPAL_WEBHOOK_ID || "" };
    const apiBaseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";
    const source = Object.values(credentials).some(Boolean) ? "environment" as const : null;
    return { provider, enabled: Boolean(credentials.clientId && credentials.clientSecret && credentials.webhookId), mode: apiBaseUrl.includes("sandbox") ? "test" : "live", accountLabel: source ? "PayPal environment" : "", source, public: { apiBaseUrl }, credentials };
  }
  const credentials = { merchantId: process.env.SEPAY_MERCHANT_ID || "", secretKey: process.env.SEPAY_SECRET_KEY || "", webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || "" };
  const publicConfig = { bankAccount: process.env.SEPAY_BANK_ACCOUNT || "", bankName: process.env.SEPAY_BANK_NAME || "vietcombank", bankBin: process.env.SEPAY_BANK_BIN || "", accountHolder: "", gatewayBaseUrl: process.env.SEPAY_GATEWAY_BASE_URL || "https://pgapi-sandbox.sepay.vn" };
  const source = Object.values(credentials).some(Boolean) || publicConfig.bankAccount ? "environment" as const : null;
  return { provider, enabled: Boolean(publicConfig.bankAccount || (credentials.merchantId && credentials.secretKey)), mode: publicConfig.gatewayBaseUrl.includes("sandbox") ? "test" : "live", accountLabel: source ? "SePay environment" : "", source, public: publicConfig, credentials };
}

export async function getBillingProviderConfig(provider: BillingProviderId): Promise<BillingProviderRuntimeConfig> {
  const fallback = environmentConfig(provider);
  const { data, error } = await createAdminClient().from("billing_provider_configs").select("provider, enabled, mode, account_label, public_config, encrypted_credentials").eq("provider", provider).maybeSingle();
  if (error || !data) return fallback;
  const row = data as StoredConfig;
  const credentials = { ...fallback.credentials, ...decryptCredentials(row.encrypted_credentials) };
  const publicConfig = { ...fallback.public, ...strings(row.public_config) };
  const hasDatabaseValues = Boolean(row.account_label || Object.keys(strings(row.public_config)).length || Object.keys(decryptCredentials(row.encrypted_credentials)).length);
  return {
    provider,
    enabled: hasDatabaseValues ? row.enabled : fallback.enabled,
    mode: hasDatabaseValues ? row.mode : fallback.mode,
    accountLabel: row.account_label || fallback.accountLabel,
    source: hasDatabaseValues ? "database" : fallback.source,
    public: publicConfig,
    credentials,
  };
}

export async function getAllBillingProviderConfigs() {
  return Promise.all(providers.map(getBillingProviderConfig));
}

export function billingProviderReady(config: BillingProviderRuntimeConfig) {
  if (!config.enabled) return false;
  if (config.provider === "stripe") return Boolean(config.credentials.secretKey && config.credentials.webhookSecret);
  if (config.provider === "paypal") return Boolean(config.credentials.clientId && config.credentials.clientSecret && config.credentials.webhookId);
  return Boolean(config.public.bankAccount || (config.credentials.merchantId && config.credentials.secretKey));
}
