import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { billingProviderReady, getAllBillingProviderConfigs } from "@/lib/billing/config";
import { syncPayPalCatalogPlan, syncStripeCatalogPrice } from "@/lib/billing/providers";

export async function syncDefaultBillingCatalog() {
  const admin = createAdminClient();
  const [{ data: plans, error: plansError }, { data: currentPrices, error: pricesError }, configs] = await Promise.all([
    admin.from("plans").select("id, name, is_free, is_public, price_monthly, price_yearly").eq("is_public", true).eq("is_free", false),
    admin.from("billing_provider_prices").select("*"),
    getAllBillingProviderConfigs(),
  ]);
  if (plansError) throw plansError;
  if (pricesError) throw pricesError;

  let synced = 0;
  const errors: string[] = [];
  for (const provider of ["stripe", "paypal"] as const) {
    const config = configs.find((item) => item.provider === provider);
    if (!config || !billingProviderReady(config)) continue;
    for (const plan of plans || []) {
      let productId = (currentPrices || []).find((row) => row.plan_id === plan.id && row.provider === provider)?.external_product_id || null;
      for (const interval of ["monthly", "yearly"] as const) {
        const amount = interval === "monthly" ? plan.price_monthly : plan.price_yearly;
        if (amount <= 0) continue;
        const existing = (currentPrices || []).find((row) => row.plan_id === plan.id && row.provider === provider && row.billing_interval === interval);
        if (existing?.active && existing.amount === amount && existing.external_price_id) {
          productId = existing.external_product_id || productId;
          continue;
        }
        try {
          const remote = provider === "stripe"
            ? await syncStripeCatalogPrice({ planName: plan.name, interval, amount, existingProductId: productId })
            : await syncPayPalCatalogPlan({ planName: plan.name, interval, amount, existingProductId: productId });
          productId = remote.productId;
          const { error } = await admin.from("billing_provider_prices").upsert({
            plan_id: plan.id,
            provider,
            billing_interval: interval,
            currency: "USD",
            amount,
            external_product_id: remote.productId,
            external_price_id: remote.priceId,
            active: true,
          }, { onConflict: "plan_id,provider,billing_interval" });
          if (error) throw error;
          synced += 1;
        } catch (error) {
          errors.push(`${provider}:${plan.name}:${interval}: ${error instanceof Error ? error.message : "catalog sync failed"}`);
        }
      }
    }
  }
  return { synced, errors };
}
