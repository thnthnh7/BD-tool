import { loadBilling } from "@/lib/billing/actions";
import { vietqrImageUrl } from "@/lib/billing/sepay";
import { BillingPanel } from "@/components/billing-panel";
import { loadUsdRates } from "@/lib/billing/localization";
import { billingProviderReady, getAllBillingProviderConfigs } from "@/lib/billing/config";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: requestedPlanId } = await searchParams;
  const [{ context, invoices, plans, subscription, providerPrices }, usdRates, providerConfigs] = await Promise.all([
    loadBilling(),
    loadUsdRates(),
    getAllBillingProviderConfigs(),
  ]);
  const pending = invoices.find((item) => item.status === "pending");
  const qrUrl = pending && (!pending.provider || pending.provider === "sepay")
    ? await vietqrImageUrl(pending.payment_code, pending.amount)
    : undefined;
  const providerById = new Map(providerConfigs.map((config) => [config.provider, config]));
  return (
    <BillingPanel
      plans={plans}
      providerPrices={providerPrices}
      usdRates={usdRates}
      locale={context.locale}
      invoices={invoices}
      currentPlanId={context.plan.id}
      canPay={context.memberRole === "owner"}
      qrUrl={qrUrl}
      subscription={subscription}
      providers={{
        stripe: billingProviderReady(providerById.get("stripe")!),
        paypal: billingProviderReady(providerById.get("paypal")!),
      }}
      requestedPlanId={requestedPlanId}
    />
  );
}
