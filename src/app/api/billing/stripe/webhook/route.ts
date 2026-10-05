import { NextRequest, NextResponse } from "next/server";
import { loadStripeSubscription, verifyStripeWebhook } from "@/lib/billing/providers";
import { beginWebhookEvent, finishWebhookEvent, markInvoicePaid, syncExternalSubscription } from "@/lib/billing/subscription-service";

export const runtime = "nodejs";

type StripeObject = Record<string, unknown> & { id?: string; metadata?: Record<string, string> };

function secondsToIso(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : undefined;
}

async function syncStripeSubscription(object: StripeObject) {
  const metadata = object.metadata || {};
  if (!object.id || !metadata.workspace_id || !metadata.plan_id) return;
  const items = object.items as { data?: Array<{ price?: { id?: string }; current_period_start?: number; current_period_end?: number }> } | undefined;
  const firstItem = items?.data?.[0];
  await syncExternalSubscription({
    provider: "stripe",
    workspaceId: metadata.workspace_id,
    planId: metadata.plan_id,
    interval: metadata.interval === "yearly" ? "yearly" : "monthly",
    externalSubscriptionId: object.id,
    externalCustomerId: typeof object.customer === "string" ? object.customer : null,
    externalPlanId: firstItem?.price?.id || null,
    providerStatus: String(object.status || "pending"),
    currentPeriodStart: secondsToIso(object.current_period_start ?? firstItem?.current_period_start),
    currentPeriodEnd: secondsToIso(object.current_period_end ?? firstItem?.current_period_end),
    cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await verifyStripeWebhook(rawBody, request.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(rawBody) as { id: string; type: string; data: { object: StripeObject } };
  const shouldProcess = await beginWebhookEvent("stripe", event.id, event.type, event);
  if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });

  try {
    const object = event.data.object;
    if (event.type === "checkout.session.completed" && typeof object.subscription === "string") {
      await syncStripeSubscription(await loadStripeSubscription(object.subscription) as StripeObject);
    } else if (event.type.startsWith("customer.subscription.")) {
      await syncStripeSubscription(object);
    } else if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type)) {
      const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : parent?.subscription_details?.subscription;
      if (subscriptionId) {
        const subscription = await loadStripeSubscription(subscriptionId) as StripeObject;
        await syncStripeSubscription(subscription);
        const invoiceId = subscription.metadata?.invoice_id;
        if (invoiceId && object.id) {
          const taxes = Array.isArray(object.total_taxes) ? object.total_taxes as Array<{ amount?: number }> : [];
          const address = object.customer_address as { country?: string } | undefined;
          await markInvoicePaid(invoiceId, object.id, "stripe", event, {
            subtotal: typeof object.subtotal === "number" ? object.subtotal : undefined,
            tax: taxes.reduce((sum, item) => sum + Number(item.amount || 0), 0),
            total: typeof object.amount_paid === "number" ? object.amount_paid : undefined,
            currency: typeof object.currency === "string" ? object.currency : undefined,
            billingCountry: address?.country,
          });
        }
      }
    } else if (["invoice.payment_failed", "invoice.payment_action_required"].includes(event.type)) {
      const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined;
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : parent?.subscription_details?.subscription;
      if (subscriptionId) await syncStripeSubscription(await loadStripeSubscription(subscriptionId) as StripeObject);
    }
    await finishWebhookEvent("stripe", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed";
    await finishWebhookEvent("stripe", event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
