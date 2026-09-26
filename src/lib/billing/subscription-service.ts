import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlanStatus } from "@/lib/billing/plan-access";

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

const activeStatuses = new Set(["active", "trialing", "ACTIVE", "APPROVAL_PENDING"]);
const pastDueStatuses = new Set(["past_due", "unpaid", "SUSPENDED", "PAYMENT_FAILED"]);

function localStatus(providerStatus: string) {
  if (activeStatuses.has(providerStatus)) return "active";
  if (pastDueStatuses.has(providerStatus)) return "past_due";
  if (["canceled", "cancelled", "CANCELLED", "EXPIRED"].includes(providerStatus)) return "expired";
  return "pending";
}

export async function syncExternalSubscription(input: SubscriptionSync) {
  const admin = createAdminClient();
  const status = localStatus(input.providerStatus);
  const fallbackEnd = new Date();
  fallbackEnd.setUTCMonth(fallbackEnd.getUTCMonth() + (input.interval === "yearly" ? 12 : 1));
  const values = {
    workspace_id: input.workspaceId,
    plan_id: input.planId,
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
  };
  const { error } = await admin.from("subscriptions").upsert(values as never, { onConflict: "workspace_id" });
  if (error) throw error;
  const { data: workspace } = await admin.from("workspaces")
    .select("plan_deactivated_at")
    .eq("id", input.workspaceId)
    .maybeSingle();
  await admin.from("workspaces").update({
    plan_id: input.planId,
    plan_status: effectivePlanStatus(status as "active" | "past_due" | "expired" | "canceled", workspace?.plan_deactivated_at),
  }).eq("id", input.workspaceId);
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
