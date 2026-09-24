import { loadBilling } from "@/lib/billing/actions";
import { vietqrImageUrl } from "@/lib/billing/sepay";
import { BillingPanel } from "@/components/billing-panel";

export default async function BillingPage() {
  const { context, invoices, plans } = await loadBilling();
  const pending = invoices.find((item) => item.status === "pending");
  const qrUrl = pending ? vietqrImageUrl(pending.payment_code, pending.amount) : undefined;
  return (
    <BillingPanel
      plans={plans}
      invoices={invoices}
      currentPlanId={context.plan.id}
      canPay={context.memberRole === "owner"}
      qrUrl={qrUrl}
    />
  );
}
