import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlanStatus } from "@/lib/billing/plan-access";
import { loadPayPalSubscription, loadStripeSubscription } from "@/lib/billing/providers";
import { createEntitlementSnapshot, parsePlan } from "@/lib/entitlements";

type SubscriptionSync = {
  provider: "stripe" | "paypal";
  workspaceId: string;
  planId: string;
  interval: "monthly" | "yearly";
  externalSubscriptionId: string;
  externalCustomerId?: string | null;
  externalPlanId?: string | null;
  providerStatus: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

const activeStatuses = new Set(["active", "trialing", "ACTIVE"]);
const pastDueStatuses = new Set(["past_due", "PAYMENT_FAILED"]);
const suspendedStatuses = new Set(["unpaid", "paused", "SUSPENDED"]);

function localStatus(providerStatus: string) {
  if (activeStatuses.has(providerStatus)) return "active";
  if (pastDueStatuses.has(providerStatus)) return "past_due";
  if (suspendedStatuses.has(providerStatus)) return "suspended";
  if (["canceled", "cancelled", "CANCELLED"].includes(providerStatus)) return "canceled";
  if (providerStatus === "EXPIRED" || providerStatus === "incomplete_expired") return "expired";
  return "pending";
}

export async function syncExternalSubscription(input: SubscriptionSync) {
  const admin = createAdminClient();
  const status = localStatus(input.providerStatus);
  const { data: mappedPrice } = input.externalPlanId
    ? await admin.from("billing_provider_prices")
      .select("plan_id")
      .eq("provider", input.provider)
      .eq("external_price_id", input.externalPlanId)
      .eq("active", true)
      .maybeSingle()
    : { data: null };
  const verifiedPlanId = mappedPrice?.plan_id || input.planId;
  const [{ data: existing }, { data: planRow }] = await Promise.all([
    admin.from("subscriptions").select("plan_id, external_subscription_id, entitlement_snapshot, entitlement_version")
      .eq("workspace_id", input.workspaceId).maybeSingle(),
    admin.from("plans").select("*").eq("id", verifiedPlanId).maybeSingle(),
  ]);
  const fallbackEnd = new Date();
  fallbackEnd.setUTCMonth(fallbackEnd.getUTCMonth() + (input.interval === "yearly" ? 12 : 1));
  const isNewSubscription = !existing?.entitlement_snapshot
    || existing.plan_id !== verifiedPlanId
    || existing.external_subscription_id !== input.externalSubscriptionId;
  const values: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    plan_id: verifiedPlanId,
    billing_interval: input.interval,
    provider: input.provider,
    external_customer_id: input.externalCustomerId || null,
    external_subscription_id: input.externalSubscriptionId,
    external_plan_id: input.externalPlanId || null,
    provider_status: input.providerStatus,
    status,
    current_period_start: input.currentPeriodStart || new Date().toISOString(),
    current_period_end: input.currentPeriodEnd || fallbackEnd.toISOString(),
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    last_reconciled_at: new Date().toISOString(),
    reconciliation_error: null,
  };
  if (isNewSubscription && planRow) {
    values.entitlement_version = Number(planRow.entitlement_version || 1);
    values.entitlement_snapshot = createEntitlementSnapshot(parsePlan(planRow), Number(planRow.entitlement_version || 1));
  }
  const { error } = await admin.from("subscriptions").upsert(values as never, { onConflict: "workspace_id" });
  if (error) throw error;
  const { data: workspace } = await admin.from("workspaces")
    .select("plan_deactivated_at")
    .eq("id", input.workspaceId)
    .maybeSingle();
  if (status === "pending") return;
  const workspacePatch: Record<string, unknown> = {
    plan_status: effectivePlanStatus(status, workspace?.plan_deactivated_at),
  };
  if (["active", "trialing", "past_due"].includes(status)) workspacePatch.plan_id = verifiedPlanId;
  await admin.from("workspaces").update(workspacePatch as never).eq("id", input.workspaceId);
}

function secondsToIso(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : undefined;
}

export async function reconcileExternalSubscriptions(limit = 50) {
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin.from("subscriptions")
    .select("*")
    .in("provider", ["stripe", "paypal"])
    .not("external_subscription_id", "is", null)
    .order("last_reconciled_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;
  let reconciled = 0;
  let failed = 0;
  for (const subscription of subscriptions || []) {
    try {
      const remote = subscription.provider === "stripe"
        ? await loadStripeSubscription(String(subscription.external_subscription_id))
        : await loadPayPalSubscription(String(subscription.external_subscription_id));
      if (subscription.provider === "stripe") {
        const items = remote.items as { data?: Array<{ price?: { id?: string }; current_period_start?: number; current_period_end?: number }> } | undefined;
        const item = items?.data?.[0];
        await syncExternalSubscription({
          provider: "stripe", workspaceId: subscription.workspace_id, planId: subscription.plan_id,
          interval: subscription.billing_interval === "yearly" ? "yearly" : "monthly",
          externalSubscriptionId: String(subscription.external_subscription_id),
          externalCustomerId: typeof remote.customer === "string" ? remote.customer : null,
          externalPlanId: item?.price?.id || subscription.external_plan_id,
          providerStatus: String(remote.status || "pending"),
          currentPeriodStart: secondsToIso(remote.current_period_start ?? item?.current_period_start),
          currentPeriodEnd: secondsToIso(remote.current_period_end ?? item?.current_period_end),
          cancelAtPeriodEnd: Boolean(remote.cancel_at_period_end),
        });
      } else {
        const billing = remote.billing_info as { next_billing_time?: string } | undefined;
        await syncExternalSubscription({
          provider: "paypal", workspaceId: subscription.workspace_id, planId: subscription.plan_id,
          interval: subscription.billing_interval === "yearly" ? "yearly" : "monthly",
          externalSubscriptionId: String(subscription.external_subscription_id),
          externalCustomerId: typeof remote.subscriber === "object" ? String((remote.subscriber as { payer_id?: string }).payer_id || "") : null,
          externalPlanId: typeof remote.plan_id === "string" ? remote.plan_id : subscription.external_plan_id,
          providerStatus: String(remote.status || "APPROVAL_PENDING"),
          currentPeriodStart: typeof remote.start_time === "string" ? remote.start_time : undefined,
          currentPeriodEnd: billing?.next_billing_time,
        });
      }
      reconciled += 1;
    } catch (reconcileError) {
      failed += 1;
      const message = reconcileError instanceof Error ? reconcileError.message.slice(0, 500) : "Reconciliation failed";
      await admin.from("subscriptions").update({
        last_reconciled_at: new Date().toISOString(), reconciliation_error: message,
      }).eq("id", subscription.id);
    }
  }
  return { reconciled, failed };
}

export async function markInvoicePaid(invoiceId: string, externalPaymentId: string, provider: "stripe" | "paypal", raw: unknown, settlement?: {
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  billingCountry?: string;
  taxCalculationId?: string;
}) {
  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) return;
  await admin.from("payments").upsert({
    invoice_id: invoice.id,
    provider,
    external_payment_id: externalPaymentId,
    channel: provider,
    amount: settlement?.total ?? invoice.amount,
    currency: settlement?.currency?.toUpperCase() || invoice.currency,
    raw,
  } as never, { onConflict: "provider,external_payment_id" });
  await admin.from("invoices").update({
    status: "paid",
    provider_status: "paid",
    paid_at: new Date().toISOString(),
    amount: settlement?.total ?? invoice.amount,
    currency: settlement?.currency?.toUpperCase() || invoice.currency,
    subtotal_amount: settlement?.subtotal ?? invoice.subtotal_amount ?? invoice.amount,
    tax_amount: settlement?.tax ?? invoice.tax_amount ?? 0,
    total_amount: settlement?.total ?? invoice.total_amount ?? invoice.amount,
    billing_country: settlement?.billingCountry || invoice.billing_country,
    tax_calculation_id: settlement?.taxCalculationId || invoice.tax_calculation_id,
  } as never).eq("id", invoiceId);
}

export async function beginWebhookEvent(provider: "stripe" | "paypal", eventId: string, eventType: string, payload: unknown) {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_webhook_events").insert({
    provider,
    external_event_id: eventId,
    event_type: eventType,
    payload,
  } as never);
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

export async function finishWebhookEvent(provider: "stripe" | "paypal", eventId: string, error?: string) {
  const admin = createAdminClient();
  await admin.from("billing_webhook_events").update({
    processed_at: error ? null : new Date().toISOString(),
    processing_error: error || null,
  } as never).eq("provider", provider).eq("external_event_id", eventId);
}
