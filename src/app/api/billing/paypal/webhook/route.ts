import { NextRequest, NextResponse } from "next/server";
import { loadPayPalSubscription, verifyPayPalWebhook } from "@/lib/billing/providers";
import { beginWebhookEvent, finishWebhookEvent, markInvoicePaid, syncExternalSubscription } from "@/lib/billing/subscription-service";

export const runtime = "nodejs";

type PayPalResource = Record<string, unknown> & { id?: string; custom_id?: string; status?: string };

function parseCustomId(value?: string) {
  const [workspaceId, planId, interval, invoiceId] = (value || "").split("|");
  return { workspaceId, planId, interval: interval === "yearly" ? "yearly" as const : "monthly" as const, invoiceId };
}

async function syncPayPalSubscription(resource: PayPalResource) {
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
  });
}

export async function POST(request: NextRequest) {
  const event = await request.json() as { id: string; event_type: string; resource: PayPalResource };
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
    if (subscriptionId) await syncPayPalSubscription(subscription);
    if (event.event_type === "PAYMENT.SALE.COMPLETED" && event.resource.id) {
      const meta = parseCustomId(subscription.custom_id);
      if (meta.invoiceId) await markInvoicePaid(meta.invoiceId, event.resource.id, "paypal", event);
    }
    await finishWebhookEvent("paypal", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PayPal webhook failed";
    await finishWebhookEvent("paypal", event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
