"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { requireOwner, requireWorkspace } from "@/lib/auth/session";
import { addMonths, createPaymentCode } from "@/lib/crypto-utils";
import { parsePlan } from "@/lib/entitlements";
import { gatewaySignature } from "@/lib/billing/sepay";
import { recordHeartbeat } from "@/lib/platform/heartbeat";

export async function createCheckoutInvoice(formData: FormData) {
  const context = await requireOwner();
  const planId = String(formData.get("planId") || context.plan.id);
  const interval = String(formData.get("interval") || "monthly") === "yearly" ? "yearly" : "monthly";
  const vatRequested = String(formData.get("vat") || "") === "on";
  const vatTaxCode = String(formData.get("vatTaxCode") || "");

  const supabase = await createClient();
  const { data: planRow } = await supabase.from("plans").select("*").eq("id", planId).single();
  if (!planRow) return { error: "Gói không tồn tại." };
  const plan = parsePlan(planRow);
  if (plan.isFree) return { error: "Gói Free không cần thanh toán." };

  const amount = interval === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const { data: sub } = await supabase.from("subscriptions").select("id").eq("workspace_id", context.workspaceId).maybeSingle();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      workspace_id: context.workspaceId,
      subscription_id: sub?.id,
      plan_id: plan.id,
      payment_code: createPaymentCode(),
      amount,
      billing_interval: interval,
      price_snapshot: {
        name: plan.name,
        price_monthly: plan.priceMonthly,
        price_yearly: plan.priceYearly,
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
  const [{ data: invoices }, { data: plans }, { data: subscription }] = await Promise.all([
    supabase.from("invoices").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("subscriptions").select("*").eq("workspace_id", context.workspaceId).maybeSingle(),
  ]);
  return { context, invoices: invoices || [], plans: (plans || []).map(parsePlan), subscription };
}

export async function initGatewayCheckout(invoiceId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return { error: "Invoice không tồn tại." };

  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const secret = process.env.SEPAY_SECRET_KEY;
  const base = process.env.SEPAY_GATEWAY_BASE_URL || "https://pgapi-sandbox.sepay.vn";
  if (!merchantId || !secret) return { error: "Chưa cấu hình SePay Gateway." };

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
  if (amount < invoice.amount) return { error: "Amount too low" };

  await admin.from("payments").insert({
    invoice_id: invoice.id,
    sepay_id: sepayId,
    channel,
    amount,
    raw: payload as never,
  });
  await admin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoice.id);

  const { data: sub } = await admin.from("subscriptions").select("*").eq("workspace_id", invoice.workspace_id).maybeSingle();
  const periodEnd = addMonths(new Date(sub?.current_period_end || Date.now()), invoice.billing_interval === "yearly" ? 12 : 1);
  if (sub) {
    await admin.from("subscriptions").update({
      plan_id: invoice.plan_id,
      status: "active",
      billing_interval: invoice.billing_interval,
      current_period_end: periodEnd.toISOString(),
    }).eq("id", sub.id);
  }
  await admin.from("workspaces").update({ plan_id: invoice.plan_id, plan_status: "active" }).eq("id", invoice.workspace_id);
  return { ok: true as const };
}

export async function runBillingCron() {
  if (!hasServiceRole()) return { error: "Missing service role" };
  const admin = createAdminClient();
  const now = new Date();
  let updated = 0;
  try {
    const { data: subs } = await admin.from("subscriptions").select("*").in("status", ["active", "trialing", "past_due"]);
    for (const sub of subs || []) {
      const end = new Date(sub.current_period_end);
      const graceEnd = new Date(end);
      graceEnd.setUTCDate(graceEnd.getUTCDate() + sub.grace_days);
      if (now > graceEnd) {
        await admin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
        await admin.from("workspaces").update({ plan_status: "expired" }).eq("id", sub.workspace_id);
        updated += 1;
      } else if (now > end && sub.status !== "past_due") {
        await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
        await admin.from("workspaces").update({ plan_status: "past_due" }).eq("id", sub.workspace_id);
        updated += 1;
      }
    }
    await anonymizeDeletedProfiles(admin);
    await recordHeartbeat("billing_cron", true, `updated ${updated}`);
    return { ok: true as const, updated };
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
