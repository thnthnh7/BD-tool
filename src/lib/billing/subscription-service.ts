import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlanStatus } from "@/lib/billing/plan-access";
import { loadPayPalSubscription, loadStripeSubscription } from "@/lib/billing/providers";
import { createEntitlementSnapshot, parsePlan } from "@/lib/entitlements";
import { createPaymentCode } from "@/lib/crypto-utils";
import { canceledProviderStatuses, providerAccessStatus } from "@/lib/billing/subscription-state";

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
  providerEventAt?: string;
};

export async function syncExternalSubscription(input: SubscriptionSync) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("subscriptions")
    .select("id, plan_id, status, billing_interval, external_subscription_id, external_plan_id, entitlement_snapshot, entitlement_version, current_period_end, provider_event_at")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  const { data: mappedPrice } = input.externalPlanId
    ? await admin.from("billing_provider_prices")
      .select("plan_id, billing_interval")
      .eq("provider", input.provider)
      .eq("external_price_id", input.externalPlanId)
      .eq("active", true)
      .maybeSingle()
    : { data: null };
  const matchesExistingProviderPrice = Boolean(
    existing?.external_subscription_id === input.externalSubscriptionId
    && existing.external_plan_id
    && existing.external_plan_id === input.externalPlanId,
  );
  if (!mappedPrice?.plan_id && !matchesExistingProviderPrice) {
    throw new Error("The provider price is not mapped to a Bizcraw plan.");
  }
  // The provider price is authoritative. PayPal keeps the original custom_id
  // after a plan revision, so metadata is only used to locate the workspace.
  // The existing verified mapping remains valid after an admin publishes a new
  // price for the same plan and billing interval.
  const verifiedPlanId = mappedPrice?.plan_id || String(existing?.plan_id);
  const verifiedInterval = mappedPrice?.billing_interval === "yearly"
    ? "yearly"
    : mappedPrice?.billing_interval === "monthly"
      ? "monthly"
      : existing?.billing_interval === "yearly" ? "yearly" : "monthly";
  const { data: planRow } = await admin.from("plans").select("*").eq("id", verifiedPlanId).maybeSingle();
  if (!planRow) throw new Error("The mapped Bizcraw plan no longer exists.");
  const incomingEventAt = input.providerEventAt ? new Date(input.providerEventAt) : new Date();
  if (Number.isNaN(incomingEventAt.getTime())) throw new Error("Invalid provider event timestamp.");
  if (existing?.provider_event_at && new Date(existing.provider_event_at).getTime() > incomingEventAt.getTime()) return;
  const currentPeriodEnd = input.currentPeriodEnd
    || (existing?.external_subscription_id === input.externalSubscriptionId ? existing.current_period_end : undefined);
  const status = providerAccessStatus(input.providerStatus, currentPeriodEnd);
  if (["active", "trialing", "past_due"].includes(status) && !currentPeriodEnd) {
    throw new Error("The provider did not return a verified billing period end.");
  }
  const isNewSubscription = !existing?.entitlement_snapshot
    || existing.plan_id !== verifiedPlanId
    || existing.external_subscription_id !== input.externalSubscriptionId;
  const values: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    plan_id: verifiedPlanId,
    billing_interval: verifiedInterval,
    provider: input.provider,
    external_customer_id: input.externalCustomerId || null,
    external_subscription_id: input.externalSubscriptionId,
    external_plan_id: input.externalPlanId || null,
    provider_status: input.providerStatus,
    status,
    current_period_start: input.currentPeriodStart || new Date().toISOString(),
    current_period_end: currentPeriodEnd || new Date().toISOString(),
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd) || canceledProviderStatuses.has(input.providerStatus),
    provider_event_at: incomingEventAt.toISOString(),
    last_reconciled_at: new Date().toISOString(),
    reconciliation_error: null,
  };
  if (isNewSubscription) {
    values.entitlement_version = Number(planRow.entitlement_version || 1);
    values.entitlement_snapshot = createEntitlementSnapshot(parsePlan(planRow), Number(planRow.entitlement_version || 1));
  }
  const { data: saved, error } = await admin.from("subscriptions").upsert(values as never, { onConflict: "workspace_id" }).select("id").single();
  if (error) throw error;
  if (!existing || existing.plan_id !== verifiedPlanId || existing.status !== status) {
    await admin.from("subscription_events").insert({
      workspace_id: input.workspaceId,
      subscription_id: saved?.id || existing?.id || null,
      event_type: "provider_sync",
      from_plan_id: existing?.plan_id || null,
      to_plan_id: verifiedPlanId,
      provider: input.provider,
      metadata: { provider_status: input.providerStatus, local_status: status },
    });
  }
  const { data: workspace } = await admin.from("workspaces")
    .select("plan_deactivated_at")
    .eq("id", input.workspaceId)
    .maybeSingle();
  if (status === "pending") return;
  if (status === "canceled" || status === "expired") {
    const { data: freePlan } = await admin.from("plans").select("id").eq("is_free", true).eq("is_public", true).order("sort_order").limit(1).maybeSingle();
    if (!freePlan) throw new Error("The public Free plan is not configured.");
    await admin.from("workspaces").update({
      plan_id: freePlan.id,
      plan_status: effectivePlanStatus("active", workspace?.plan_deactivated_at),
    }).eq("id", input.workspaceId);
    await admin.from("subscriptions").update({ ended_at: new Date().toISOString() }).eq("workspace_id", input.workspaceId);
    return;
  }
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
          providerEventAt: new Date().toISOString(),
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
          providerEventAt: new Date().toISOString(),
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

export async function recordProviderPayment(input: {
  provider: "stripe" | "paypal";
  externalSubscriptionId: string;
  externalInvoiceId: string;
  externalPaymentId: string;
  preferredInvoiceId?: string;
  raw: unknown;
  subtotal?: number;
  tax?: number;
  total: number;
  currency: string;
  billingCountry?: string;
}) {
  const admin = createAdminClient();
  let { data: invoice } = await admin.from("invoices").select("*")
    .eq("provider", input.provider)
    .eq("external_invoice_id", input.externalInvoiceId)
    .maybeSingle();

  if (!invoice && input.preferredInvoiceId) {
    const { data: preferred } = await admin.from("invoices").select("*")
      .eq("id", input.preferredInvoiceId)
      .eq("provider", input.provider)
      .eq("status", "pending")
      .maybeSingle();
    if (preferred) {
      const { data: updated } = await admin.from("invoices").update({ external_invoice_id: input.externalInvoiceId })
        .eq("id", preferred.id).select("*").single();
      invoice = updated;
    }
  }

  if (!invoice) {
    const { data: subscription } = await admin.from("subscriptions").select("id, workspace_id, plan_id, billing_interval")
      .eq("provider", input.provider)
      .eq("external_subscription_id", input.externalSubscriptionId)
      .maybeSingle();
    if (!subscription) throw new Error("No local subscription matches the provider payment.");
    const { data: pendingInvoice } = await admin.from("invoices").select("*")
      .eq("workspace_id", subscription.workspace_id)
      .eq("plan_id", subscription.plan_id)
      .eq("provider", input.provider)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingInvoice) {
      const { data: updated } = await admin.from("invoices").update({ external_invoice_id: input.externalInvoiceId })
        .eq("id", pendingInvoice.id).select("*").single();
      invoice = updated;
    }
    if (invoice) {
      await markInvoicePaid(invoice.id, input.externalPaymentId, input.provider, input.raw, {
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        currency: input.currency,
        billingCountry: input.billingCountry,
      });
      return;
    }
    const { data: plan } = await admin.from("plans").select("name").eq("id", subscription.plan_id).maybeSingle();
    const { data: created, error } = await admin.from("invoices").insert({
      workspace_id: subscription.workspace_id,
      subscription_id: subscription.id,
      plan_id: subscription.plan_id,
      payment_code: createPaymentCode(),
      amount: input.total,
      currency: input.currency.toUpperCase(),
      billing_interval: subscription.billing_interval,
      price_snapshot: { name: plan?.name || "Bizcraw subscription", renewal: true },
      status: "pending",
      provider: input.provider,
      external_invoice_id: input.externalInvoiceId,
      provider_status: "payment_received",
      billing_country: input.billingCountry || "",
      subtotal_amount: input.subtotal ?? input.total,
      tax_amount: input.tax ?? 0,
      total_amount: input.total,
    }).select("*").single();
    if (error || !created) throw error || new Error("Could not create the renewal invoice.");
    invoice = created;
  }

  await markInvoicePaid(invoice.id, input.externalPaymentId, input.provider, input.raw, {
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    currency: input.currency,
    billingCountry: input.billingCountry,
  });
}

export async function updatePaymentRefundStatus(
  provider: "stripe" | "paypal",
  externalPaymentId: string,
  refundStatus: "refunded" | "reversed" | "disputed" | "dispute_closed",
) {
  const admin = createAdminClient();
  const { error } = await admin.from("payments").update({ refund_status: refundStatus })
    .eq("provider", provider)
    .eq("external_payment_id", externalPaymentId);
  if (error) throw error;
}

export async function beginWebhookEvent(provider: "stripe" | "paypal", eventId: string, eventType: string, payload: unknown) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_billing_webhook_event", {
    p_provider: provider,
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: payload as never,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function finishWebhookEvent(provider: "stripe" | "paypal", eventId: string, error?: string) {
  const admin = createAdminClient();
  await admin.from("billing_webhook_events").update({
    processed_at: error ? null : new Date().toISOString(),
    processing_error: error || null,
    processing_started_at: null,
  } as never).eq("provider", provider).eq("external_event_id", eventId);
}
