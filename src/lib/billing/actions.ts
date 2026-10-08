import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { effectivePlanStatus } from "@/lib/billing/plan-access";
import { requireOwner, requireWorkspace } from "@/lib/auth/session";
import { createPaymentCode } from "@/lib/crypto-utils";
import { parsePlan } from "@/lib/entitlements";
import { gatewaySignature } from "@/lib/billing/sepay";
import { recordHeartbeat } from "@/lib/platform/heartbeat";
import { cancelPayPalSubscription, changeStripeSubscriptionPlan, createPayPalSubscription, createStripeSubscriptionCheckout, revisePayPalSubscription, setStripeSubscriptionCancellation, type BillingProvider } from "@/lib/billing/providers";
import { convertUsdCents, loadUsdRates, marketForLocale } from "@/lib/billing/localization";
import { getBillingProviderConfig } from "@/lib/billing/config";
import { reconcileExternalSubscriptions } from "@/lib/billing/subscription-service";
import { syncDefaultBillingCatalog } from "@/lib/billing/catalog-sync";

export async function createCheckoutInvoice(formData: FormData) {
  const context = await requireOwner();
  const planId = String(formData.get("planId") || context.plan.id);
  const interval = String(formData.get("interval") || "monthly") === "yearly" ? "yearly" : "monthly";
  const vatRequested = String(formData.get("vat") || "") === "on";
  const vatTaxCode = String(formData.get("vatTaxCode") || "");
  const billingCountry = String(formData.get("billingCountry") || "VN").toUpperCase();
  if (billingCountry !== "VN") return { error: "SePay is available for Vietnam billing addresses only." };

  const supabase = await createClient();
  const { data: planRow } = await supabase.from("plans").select("*").eq("id", planId).single();
  if (!planRow) return { error: "Gói không tồn tại." };
  const plan = parsePlan(planRow);
  if (plan.isFree) return { error: "Gói Free không cần thanh toán." };

  const { data: usdPrice } = await supabase.from("billing_provider_prices").select("amount")
    .eq("plan_id", plan.id).eq("billing_interval", interval).eq("currency", "USD").eq("active", true).limit(1).maybeSingle();
  if (!usdPrice?.amount) return { error: "Chưa cấu hình giá USD cho gói này." };
  const amount = convertUsdCents(usdPrice.amount, "VND", await loadUsdRates());
  const { data: sub } = await supabase.from("subscriptions").select("id, provider, status, external_subscription_id").eq("workspace_id", context.workspaceId).maybeSingle();
  if (sub?.external_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
    return { error: `Your active subscription is managed by ${sub.provider.toUpperCase()}. Cancel it before switching to bank-transfer billing.` };
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      workspace_id: context.workspaceId,
      subscription_id: sub?.id,
      plan_id: plan.id,
      payment_code: createPaymentCode(),
      amount,
      currency: "VND",
      billing_country: billingCountry,
      display_currency: "VND",
      subtotal_amount: amount,
      total_amount: amount,
      billing_interval: interval,
      price_snapshot: {
        name: plan.name,
        currency: "USD",
        amount_cents: usdPrice.amount,
        billing_interval: interval,
      },
      vat_requested: vatRequested,
      vat_tax_code: vatRequested ? vatTaxCode : "",
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !invoice) return { error: error?.message || "Không tạo được hóa đơn." };
  revalidatePath("/app/billing");
  return { ok: true as const, invoiceId: invoice.id };
}

export async function loadBilling() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const [{ data: invoices }, { data: plans }, { data: subscription }, { data: providerPrices }] = await Promise.all([
    supabase.from("invoices").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("subscriptions").select("*").eq("workspace_id", context.workspaceId).maybeSingle(),
    supabase.from("billing_provider_prices").select("*").eq("active", true),
  ]);
  return { context, invoices: invoices || [], plans: (plans || []).map(parsePlan), subscription, providerPrices: providerPrices || [] };
}

export async function initGatewayCheckout(invoiceId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return { error: "Invoice không tồn tại." };

  const config = await getBillingProviderConfig("sepay");
  const merchantId = config.credentials.merchantId;
  const secret = config.credentials.secretKey;
  const base = config.source === "database"
    ? (config.mode === "live" ? "https://pgapi.sepay.vn" : "https://pgapi-sandbox.sepay.vn")
    : config.public.gatewayBaseUrl || "https://pgapi-sandbox.sepay.vn";
  if (!config.enabled || !merchantId || !secret) return { error: "Chưa cấu hình SePay Gateway." };

  const payload = {
    merchant_id: merchantId,
    order_id: invoice.payment_code,
    amount: invoice.amount,
    description: invoice.payment_code,
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app/billing?result=success`,
    error_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app/billing?result=error`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app/billing?result=cancel`,
  };
  const body = JSON.stringify(payload);
  const signature = gatewaySignature(body, secret);
  const auth = Buffer.from(`${merchantId}:${secret}`).toString("base64");

  const response = await fetch(`${base}/v1/checkout/init`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "X-Signature": signature,
    },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as { checkout_url?: string; payment_url?: string; url?: string; message?: string };
  const url = json.checkout_url || json.payment_url || json.url;
  if (!url) return { error: json.message || "Không tạo được phiên Gateway." };
  return { url };
}

export async function initiateSubscriptionCheckout(formData: FormData) {
  const context = await requireOwner();
  const provider = String(formData.get("provider") || "") as BillingProvider;
  const planId = String(formData.get("planId") || "");
  const interval = String(formData.get("interval") || "monthly") === "yearly" ? "yearly" : "monthly";
  const billingCountry = String(formData.get("billingCountry") || marketForLocale(context.locale).country).toUpperCase();
  const displayCurrency = String(formData.get("displayCurrency") || marketForLocale(context.locale).currency).toUpperCase();
  if (provider !== "stripe" && provider !== "paypal") return { error: "Phương thức thanh toán không hợp lệ." };

  const supabase = await createClient();
  const [{ data: planRow }, { data: price }, { data: subscription }] = await Promise.all([
    supabase.from("plans").select("*").eq("id", planId).single(),
    supabase.from("billing_provider_prices").select("*")
      .eq("plan_id", planId).eq("provider", provider).eq("billing_interval", interval).eq("active", true).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("workspace_id", context.workspaceId).maybeSingle(),
  ]);
  if (!planRow) return { error: "Gói không tồn tại." };
  const plan = parsePlan(planRow);
  if (plan.isFree) return { error: "Gói Free không cần thanh toán." };
  if (!price) return { error: `Chưa cấu hình giá ${provider === "stripe" ? "Stripe" : "PayPal"} cho gói này.` };
  const changingExisting = Boolean(subscription?.external_subscription_id && ["active", "trialing", "past_due"].includes(subscription.status));
  if (changingExisting && subscription?.provider !== provider) {
    return { error: `The active subscription is managed by ${String(subscription?.provider || "another provider").toUpperCase()}. Change or cancel it with the same provider.` };
  }
  if (changingExisting && subscription?.plan_id === planId && subscription?.billing_interval === interval) {
    return { error: "This plan and billing interval are already active." };
  }

  const { data: invoice, error } = await supabase.from("invoices").insert({
    workspace_id: context.workspaceId,
    subscription_id: subscription?.id,
    plan_id: plan.id,
    payment_code: createPaymentCode(),
    amount: price.amount,
    currency: price.currency,
    billing_country: billingCountry,
    display_currency: displayCurrency,
    subtotal_amount: price.amount,
    total_amount: price.amount,
    billing_interval: interval,
    provider,
    provider_status: "checkout_created",
    price_snapshot: { name: plan.name, provider, external_price_id: price.external_price_id },
    status: "pending",
  }).select("*").single();
  if (error || !invoice) return { error: error?.message || "Không tạo được hóa đơn." };

  try {
    if (changingExisting && subscription?.external_subscription_id) {
      if (provider === "stripe") {
        await changeStripeSubscriptionPlan({
          subscriptionId: subscription.external_subscription_id,
          priceId: price.external_price_id,
          workspaceId: context.workspaceId,
          planId,
          interval,
          invoiceId: invoice.id,
        });
        return { ok: true as const, url: "/app/billing?result=plan-change-pending" };
      }
      const revision = await revisePayPalSubscription({
        subscriptionId: subscription.external_subscription_id,
        externalPlanId: price.external_price_id,
      });
      return { ok: true as const, url: revision.url };
    }
    const checkout = provider === "stripe"
      ? await createStripeSubscriptionCheckout({
          priceId: price.external_price_id,
          workspaceId: context.workspaceId,
          planId,
          interval,
          invoiceId: invoice.id,
          customerId: subscription?.provider === "stripe" ? subscription.external_customer_id : null,
          customerEmail: context.email,
          locale: context.locale,
          billingCountry,
        })
      : await createPayPalSubscription({
          externalPlanId: price.external_price_id,
          workspaceId: context.workspaceId,
          planId,
          interval,
          invoiceId: invoice.id,
          billingCountry,
        });
    await supabase.from("invoices").update({
      external_invoice_id: checkout.id,
      hosted_invoice_url: checkout.url,
    }).eq("id", invoice.id);
    return { ok: true as const, url: checkout.url };
  } catch (checkoutError) {
    const message = checkoutError instanceof Error ? checkoutError.message : "Không tạo được checkout.";
    await supabase.from("invoices").update({ status: "failed", provider_status: "checkout_failed" }).eq("id", invoice.id);
    return { error: message };
  }
}

export async function updateSubscriptionCancellation(formData: FormData) {
  const context = await requireOwner();
  const mode = String(formData.get("mode") || "cancel");
  if (mode !== "cancel" && mode !== "resume") return { error: "Unknown subscription action." };
  const supabase = await createClient();
  const { data: subscription } = await supabase.from("subscriptions").select("*")
    .eq("workspace_id", context.workspaceId).maybeSingle();
  if (!subscription?.external_subscription_id || !["stripe", "paypal"].includes(subscription.provider)) {
    return { error: "This subscription is not managed by an automatic billing provider." };
  }
  try {
    if (subscription.provider === "stripe") {
      await setStripeSubscriptionCancellation(subscription.external_subscription_id, mode === "cancel");
    } else if (mode === "cancel") {
      await cancelPayPalSubscription(subscription.external_subscription_id);
    } else {
      return { error: "A canceled PayPal subscription cannot be resumed. Start a new checkout instead." };
    }
    await supabase.from("subscriptions").update({
      cancel_at_period_end: mode === "cancel",
      canceled_at: mode === "cancel" ? new Date().toISOString() : null,
    }).eq("workspace_id", context.workspaceId);
    await supabase.from("subscription_events").insert({
      workspace_id: context.workspaceId,
      subscription_id: subscription.id,
      event_type: mode === "cancel" ? "cancellation_requested" : "cancellation_resumed",
      from_plan_id: subscription.plan_id,
      to_plan_id: subscription.plan_id,
      provider: subscription.provider,
      metadata: { current_period_end: subscription.current_period_end },
    });
    revalidatePath("/app/billing");
    return { ok: true as const };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the subscription." };
  }
}

type SepayPayload = {
  id?: string | number;
  transferType?: string;
  transferAmount?: number;
  amount?: number;
  code?: string | null;
  content?: string;
  gateway?: string;
};

export async function applySepayPayment(payload: SepayPayload, channel: "vietqr" | "gateway") {
  if (!hasServiceRole()) return { error: "Missing service role" };
  const admin = createAdminClient();
  const sepayId = String(payload.id || "");
  if (!sepayId) return { error: "Missing transaction id" };

  const { data: existing } = await admin.from("payments").select("id").eq("sepay_id", sepayId).maybeSingle();
  if (existing) return { ok: true as const, duplicate: true };

  const amount = Number(payload.transferAmount ?? payload.amount ?? 0);
  const code = String(payload.code || "").trim();
  const content = String(payload.content || "");
  if (payload.transferType && payload.transferType !== "in") return { ok: true as const, ignored: true };

  let invoice = code
    ? (await admin.from("invoices").select("*").eq("status", "pending").eq("payment_code", code).maybeSingle()).data
    : null;
  if (!invoice && content) {
    const { data: pending } = await admin.from("invoices").select("*").eq("status", "pending");
    invoice = pending?.find((row) => content.includes(row.payment_code)) ?? null;
  }
  if (!invoice) return { error: "Invoice not found" };
  const { data, error } = await admin.rpc("apply_sepay_invoice_payment", {
    p_invoice_id: invoice.id,
    p_sepay_id: sepayId,
    p_channel: channel,
    p_amount: amount,
    p_raw: payload as never,
  });
  if (error) return { error: error.message };
  return data as { ok: true; duplicate?: boolean };
}

export async function runBillingCron() {
  if (!hasServiceRole()) return { error: "Missing service role" };
  const admin = createAdminClient();
  const now = new Date();
  let updated = 0;
  try {
    const catalog = await syncDefaultBillingCatalog();
    // Provider reconciliation runs first so a successful renewal updates the
    // period before local expiry rules are evaluated.
    const reconciliation = await reconcileExternalSubscriptions();
    const { data: freePlan } = await admin.from("plans").select("id").eq("is_free", true).eq("is_public", true).order("sort_order").limit(1).maybeSingle();
    if (!freePlan) throw new Error("The public Free plan is not configured.");
    const { data: subs } = await admin.from("subscriptions").select("*").in("status", ["active", "trialing", "past_due", "canceled"]);
    for (const sub of subs || []) {
      const end = new Date(sub.current_period_end);
      const graceEnd = new Date(end);
      graceEnd.setUTCDate(graceEnd.getUTCDate() + sub.grace_days);
      const shouldEnd = sub.cancel_at_period_end && now > end;
      if (shouldEnd || now > graceEnd) {
        await admin.from("subscriptions").update({
          status: shouldEnd ? "canceled" : "expired",
          grace_ends_at: graceEnd.toISOString(),
          ended_at: now.toISOString(),
        }).eq("id", sub.id);
        const { data: workspace } = await admin.from("workspaces").select("plan_deactivated_at").eq("id", sub.workspace_id).maybeSingle();
        await admin.from("workspaces").update({
          plan_id: freePlan.id,
          plan_status: effectivePlanStatus("active", workspace?.plan_deactivated_at),
        }).eq("id", sub.workspace_id);
        await admin.from("subscription_events").insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          event_type: shouldEnd ? "cancellation_completed" : "grace_period_expired",
          from_plan_id: sub.plan_id,
          to_plan_id: freePlan.id,
          provider: sub.provider,
          metadata: { period_end: sub.current_period_end },
        });
        updated += 1;
      } else if (now > end && sub.status !== "past_due") {
        await admin.from("subscriptions").update({ status: "past_due", grace_ends_at: graceEnd.toISOString() }).eq("id", sub.id);
        await admin.from("workspaces").update({ plan_status: "past_due" }).eq("id", sub.workspace_id);
        updated += 1;
      }
    }
    const { data: pruned, error: pruneError } = await admin.rpc("prune_expired_scrape_results");
    if (pruneError) throw pruneError;
    await anonymizeDeletedProfiles(admin);
    const healthy = reconciliation.failed === 0 && catalog.errors.length === 0;
    await recordHeartbeat("billing_cron", healthy, `catalog synced ${catalog.synced}; catalog errors ${catalog.errors.length}; updated ${updated}; reconciled ${reconciliation.reconciled}; failed ${reconciliation.failed}; raw rows pruned ${pruned || 0}`);
    return { ok: true as const, updated, pruned: Number(pruned || 0), catalog, ...reconciliation };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing cron failed";
    await recordHeartbeat("billing_cron", false, message);
    return { error: message };
  }
}

async function anonymizeDeletedProfiles(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .eq("status", "deleted")
    .lt("deleted_at", cutoff);
  for (const profile of profiles || []) {
    if (profile.email.startsWith("deleted+")) continue;
    const email = `deleted+${profile.id}@invalid.local`;
    await admin.auth.admin.updateUserById(profile.id, { email, ban_duration: "876000h" });
    await admin.from("profiles").update({ email, display_name: "Deleted" }).eq("id", profile.id);
  }
}
