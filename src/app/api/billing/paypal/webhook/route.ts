import { NextRequest, NextResponse } from "next/server";
import { loadPayPalSubscription, verifyPayPalWebhook } from "@/lib/billing/providers";
import { beginWebhookEvent, finishWebhookEvent, recordProviderPayment, syncExternalSubscription, updatePaymentRefundStatus } from "@/lib/billing/subscription-service";

export const runtime = "nodejs";

type PayPalResource = Record<string, unknown> & { id?: string; custom_id?: string; status?: string };

function parseCustomId(value?: string) {
  const [workspaceId, planId, interval, invoiceId] = (value || "").split("|");
  return { workspaceId, planId, interval: interval === "yearly" ? "yearly" as const : "monthly" as const, invoiceId };
}

async function syncPayPalSubscription(resource: PayPalResource, providerEventAt?: string) {
  const meta = parseCustomId(resource.custom_id);
  if (!resource.id || !meta.workspaceId || !meta.planId) return;
  const billing = resource.billing_info as { next_billing_time?: string } | undefined;
  await syncExternalSubscription({
    provider: "paypal",
    workspaceId: meta.workspaceId,
    planId: meta.planId,
    interval: meta.interval,
    externalSubscriptionId: resource.id,
    externalCustomerId: typeof resource.subscriber === "object" ? String((resource.subscriber as { payer_id?: string }).payer_id || "") : null,
    externalPlanId: typeof resource.plan_id === "string" ? resource.plan_id : null,
    providerStatus: String(resource.status || "APPROVAL_PENDING"),
    currentPeriodStart: typeof resource.start_time === "string" ? resource.start_time : undefined,
    currentPeriodEnd: billing?.next_billing_time,
    providerEventAt,
  });
}

export async function POST(request: NextRequest) {
  const event = await request.json() as { id: string; event_type: string; create_time?: string; resource: PayPalResource };
  if (!(await verifyPayPalWebhook(request.headers, event))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const shouldProcess = await beginWebhookEvent("paypal", event.id, event.event_type, event);
  if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });

  try {
    let subscription = event.resource;
    const subscriptionId = typeof event.resource.billing_agreement_id === "string"
      ? event.resource.billing_agreement_id
      : event.event_type.startsWith("BILLING.SUBSCRIPTION.") ? event.resource.id : undefined;
    if (subscriptionId && !event.event_type.startsWith("BILLING.SUBSCRIPTION.")) {
      subscription = await loadPayPalSubscription(subscriptionId) as PayPalResource;
    }
    if (subscriptionId) await syncPayPalSubscription(subscription, event.create_time);
    if (event.event_type === "PAYMENT.SALE.COMPLETED" && event.resource.id) {
      const meta = parseCustomId(subscription.custom_id);
      const amount = event.resource.amount as { total?: string; currency?: string } | undefined;
      await recordProviderPayment({
        provider: "paypal",
        externalSubscriptionId: String(subscriptionId),
        externalInvoiceId: event.resource.id,
        externalPaymentId: event.resource.id,
        preferredInvoiceId: meta.invoiceId,
        raw: event,
        total: Math.round(Number(amount?.total || 0) * 100),
        currency: amount?.currency || "USD",
      });
    } else if (["PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED"].includes(event.event_type)) {
      const saleId = typeof event.resource.sale_id === "string" ? event.resource.sale_id : event.resource.id;
      if (saleId) await updatePaymentRefundStatus("paypal", saleId, event.event_type.endsWith("REFUNDED") ? "refunded" : "reversed");
    }
    await finishWebhookEvent("paypal", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PayPal webhook failed";
    await finishWebhookEvent("paypal", event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
