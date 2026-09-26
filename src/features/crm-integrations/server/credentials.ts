import "server-only";

import { crmProvider } from "@/features/crm-integrations/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCrmProviderCredentials(providerId: string) {
  const provider = crmProvider(providerId);
  if (!provider || provider.credentials.length === 0) return null;
  const { data, error } = await createAdminClient().rpc("get_crm_provider_credentials", { p_provider: providerId });
  if (!error && data?.[0]?.client_id && data[0].client_secret) {
    return { clientId: data[0].client_id, clientSecret: data[0].client_secret, source: "vault" as const };
  }
  const [clientIdKey, clientSecretKey] = provider.credentials;
  const clientId = process.env[clientIdKey];
  const clientSecret = process.env[clientSecretKey];
  return clientId && clientSecret ? { clientId, clientSecret, source: "environment" as const } : null;
}
