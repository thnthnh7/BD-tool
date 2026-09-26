import { loadBilling } from "@/lib/billing/actions";
import { vietqrImageUrl } from "@/lib/billing/sepay";
import { BillingPanel } from "@/components/billing-panel";
import { loadUsdRates } from "@/lib/billing/localization";

export default async function BillingPage() {
  const [{ context, invoices, plans, subscription, providerPrices }, usdRates] = await Promise.all([
    loadBilling(),
    loadUsdRates(),
  ]);
  const pending = invoices.find((item) => item.status === "pending");
  const qrUrl = pending && (!pending.provider || pending.provider === "sepay")
    ? vietqrImageUrl(pending.payment_code, pending.amount)
    : undefined;
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
        stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID),
      }}
    />
  );
}
