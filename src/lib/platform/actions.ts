"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/auth/session";
import { createEntitlementSnapshot, parsePlan } from "@/lib/entitlements";
import { syncLeadGenerationStore } from "@/features/leads/server/sync-store";
import { recordPlatformAudit } from "@/lib/platform/audit";
import { syncPayPalCatalogPlan, syncStripeCatalogPrice } from "@/lib/billing/providers";
import { billingProviderReady, getAllBillingProviderConfigs } from "@/lib/billing/config";
import { CAPABILITY_OPTIONS, MODULE_KEYS } from "@/lib/module-catalog";

export async function updatePlanAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const { data: current } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  const currentFeatures = { ...((current?.features || {}) as Record<string, unknown>) };
  delete currentFeatures.share_no_watermark;
  delete currentFeatures.google_drive;
  delete currentFeatures.vat_invoice;
  if (!current) return { error: "Gói không tồn tại." };
  const requestedSeats = Number(formData.get("seats") || 1);
  const nextQuotas = {
    seats: requestedSeats < 0 ? -1 : Math.max(1, requestedSeats),
    quotes_per_month: Number(formData.get("quotes_per_month") || 0),
    ai_briefs_per_month: -1,
    concurrent_scrape_runs: Math.max(1, Number(formData.get("concurrent_scrape_runs") || 1)),
    raw_data_retention_days: Math.max(1, Number(formData.get("raw_data_retention_days") || 7)),
  };
  const nextFeatures = {
    ...currentFeatures,
    ...Object.fromEntries(
      [...MODULE_KEYS, ...CAPABILITY_OPTIONS.map(([key]) => key)].map((key) => [
        key,
        key === "data_library" || String(formData.get(`feature_${key}`) || "") === "on",
      ]),
    ),
  };
  const entitlementsChanged = JSON.stringify(current.quotas) !== JSON.stringify(nextQuotas)
    || JSON.stringify(current.features) !== JSON.stringify(nextFeatures);
  const nextVersion = Number(current.entitlement_version || 1) + (entitlementsChanged ? 1 : 0);
  const { error } = await supabase
    .from("plans")
    .update({
      name: String(formData.get("name") || ""),
      trial_days: Number(formData.get("trial_days") || 0),
      is_public: String(formData.get("is_public") || "") === "on",
      badge: String(formData.get("badge") || ""),
      quotas: nextQuotas,
      features: nextFeatures as never,
      entitlement_version: nextVersion,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  if (entitlementsChanged && String(formData.get("apply_to_existing") || "") === "on") {
    const updatedPlan = parsePlan({ ...current, quotas: nextQuotas, features: nextFeatures });
    const snapshot = createEntitlementSnapshot(updatedPlan, nextVersion);
    const admin = createAdminClient();
    const { error: snapshotError } = await admin.from("subscriptions").update({
      entitlement_version: nextVersion,
      entitlement_snapshot: snapshot as never,
    }).eq("plan_id", id);
    if (snapshotError) return { error: snapshotError.message };
  }
  await recordPlatformAudit({
    action: "plan.update",
    entityType: "plan",
    entityId: id,
    after: { name: String(formData.get("name") || "") },
  });
  revalidatePath("/app/platform/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  updateTag("public-plans");
  return { ok: true as const };
}

export async function loadPlatformPlans() {
  await requirePlatform();
  const supabase = await createClient();
  const [{ data }, { data: workspaces }, { data: providerPrices }] = await Promise.all([
    supabase.from("plans").select("*").order("slot"),
    supabase.from("workspaces").select("plan_id"),
    supabase.from("billing_provider_prices").select("*").order("provider").order("billing_interval"),
  ]);
  const counts = new Map<string, number>();
  for (const workspace of workspaces || []) {
    counts.set(workspace.plan_id, (counts.get(workspace.plan_id) || 0) + 1);
  }
  return (data || []).map((row) => ({
    plan: parsePlan(row),
    workspaceCount: counts.get(row.id) || 0,
    providerPrices: (providerPrices || []).filter((price) => price.plan_id === row.id),
  }));
}

export async function updateProviderPricesAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const planId = String(formData.get("planId") || "");
  const monthlyAmount = Math.round(Math.max(0, Number(formData.get("usd_monthly") || 0)) * 100);
  const yearlyAmount = Math.round(Math.max(0, Number(formData.get("usd_yearly") || 0)) * 100);
  if (!monthlyAmount) return { error: "Nhập giá USD tháng lớn hơn 0." };
  const [{ data: plan }, { data: existingPrices }] = await Promise.all([
    supabase.from("plans").select("name").eq("id", planId).single(),
    supabase.from("billing_provider_prices").select("*").eq("plan_id", planId),
  ]);
  if (!plan) return { error: "Gói không tồn tại." };

  const { error: planPriceError } = await supabase.from("plans").update({
    price_monthly: monthlyAmount,
    price_yearly: yearlyAmount,
  }).eq("id", planId);
  if (planPriceError) return { error: planPriceError.message };
  for (const [interval, amount] of [["monthly", monthlyAmount], ["yearly", yearlyAmount]] as const) {
    if (!amount) continue;
    const { error } = await supabase.from("billing_provider_prices").upsert({
      plan_id: planId,
      provider: "sepay",
      billing_interval: interval,
      currency: "USD",
      amount,
      external_product_id: null,
      external_price_id: `sepay:${planId}:${interval}`,
      active: true,
    }, { onConflict: "plan_id,provider,billing_interval" });
    if (error) return { error: error.message };
  }

  const admin = createAdminClient();
  for (const [interval, amount] of [["monthly", monthlyAmount], ["yearly", yearlyAmount]] as const) {
    let stale = admin.from("billing_provider_prices").update({ active: false }).eq("plan_id", planId).eq("billing_interval", interval).eq("active", true);
    stale = amount > 0 ? stale.neq("amount", amount) : stale;
    const { error } = await stale;
    if (error) return { error: error.message };
  }

  const configs = await getAllBillingProviderConfigs();
  const configuredProviders = configs
    .filter((config) => (config.provider === "stripe" || config.provider === "paypal") && billingProviderReady(config))
    .map((config) => config.provider as "stripe" | "paypal");
  if (configuredProviders.length === 0) {
    updateTag("public-plans");
    return { ok: true as const, message: "Plan price saved. Stripe and PayPal will sync automatically after they are connected." };
  }

  try {
    for (const provider of configuredProviders) {
      let productId = (existingPrices || []).find((row) => row.provider === provider)?.external_product_id || null;
      for (const interval of ["monthly", "yearly"] as const) {
        const amount = interval === "monthly" ? monthlyAmount : yearlyAmount;
        if (!amount) continue;
        const current = (existingPrices || []).find((row) => row.provider === provider && row.billing_interval === interval);
        if (current?.active && current.amount === amount && current.external_price_id) {
          productId = current.external_product_id || productId;
          continue;
        }
        const synced = provider === "stripe"
          ? await syncStripeCatalogPrice({ planName: plan.name, interval, amount, existingProductId: productId })
          : await syncPayPalCatalogPlan({ planName: plan.name, interval, amount, existingProductId: productId });
        productId = synced.productId;
        const { error } = await supabase.from("billing_provider_prices").upsert({
          plan_id: planId,
          provider,
          billing_interval: interval,
          currency: "USD",
          amount,
          external_product_id: synced.productId,
          external_price_id: synced.priceId,
          active: true,
        }, { onConflict: "plan_id,provider,billing_interval" });
        if (error) throw error;
      }
    }
  } catch (syncError) {
    return { error: syncError instanceof Error ? syncError.message : "Không đồng bộ được bảng giá." };
  }
  await recordPlatformAudit({ action: "plan.provider_prices.update", entityType: "plan", entityId: planId });
  revalidatePath("/app/platform/plans");
  revalidatePath("/app/billing");
  revalidatePath("/pricing");
  revalidatePath("/");
  updateTag("public-plans");
  return { ok: true as const };
}

export async function updatePlanConfigurationAction(formData: FormData) {
  const detailsResult = await updatePlanAction(formData);
  if (detailsResult?.error) return detailsResult;
  if (String(formData.get("isFree") || "") === "true") {
    return { ok: true as const, message: "Plan settings were saved successfully." };
  }
  const pricingResult = await updateProviderPricesAction(formData);
  if (pricingResult?.error) {
    return {
      error: `Plan details were saved, but pricing synchronization failed: ${pricingResult.error}`,
      partial: true as const,
    };
  }
  return { ok: true as const, message: "Plan settings and provider pricing were saved successfully." };
}

function planSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createPlanAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Tên gói là bắt buộc." };

  const { data: existingPlans } = await supabase.from("plans").select("slot, slug").order("slot", { ascending: false });
  const slot = (existingPlans?.[0]?.slot || 0) + 1;
  const baseSlug = planSlug(name) || `plan-${slot}`;
  const usedSlugs = new Set((existingPlans || []).map((plan) => plan.slug));
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;

  const isFree = String(formData.get("is_free") || "") === "on";
  const planId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data: plan, error } = await supabase.from("plans").insert({
    id: planId,
    slot,
    sort_order: slot,
    name,
    slug,
    is_public: false,
    is_free: isFree,
    price_monthly: 0,
    price_yearly: 0,
    trial_days: 0,
    quotas: {
      seats: 1,
      quotes_per_month: 0,
      ai_briefs_per_month: -1,
      concurrent_scrape_runs: 1,
      raw_data_retention_days: 7,
    },
    features: {},
    badge: "",
    created_at: now,
    updated_at: now,
  }).select("id").single();
  if (error || !plan) return { error: error?.message || "Không tạo được gói." };

  await recordPlatformAudit({ action: "plan.create", entityType: "plan", entityId: plan.id, after: { name, slug } });
  revalidatePath("/app/platform/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  updateTag("public-plans");
  redirect(`/app/platform/plans?plan=${plan.id}`);
}

export async function deletePlanAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const [{ count: workspaceCount }, { data: plan }] = await Promise.all([
    supabase.from("workspaces").select("id", { count: "exact", head: true }).eq("plan_id", id),
    supabase.from("plans").select("name, is_free").eq("id", id).maybeSingle(),
  ]);
  if (!plan) return { error: "Gói không tồn tại." };
  if (plan.is_free) return { error: "Không thể xóa gói Free mặc định." };
  if ((workspaceCount || 0) > 0) return { error: "Không thể xóa gói đang được workspace sử dụng." };

  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "plan.delete", entityType: "plan", entityId: id, before: { name: plan.name } });
  revalidatePath("/app/platform/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  updateTag("public-plans");
  redirect("/app/platform/plans");
}

export async function loadPlatformWorkspaces() {
  await requirePlatform();
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("id, name, type, plan_status, locked, archived_at, created_at, plan_id").order("created_at", { ascending: false });
  return data || [];
}

export async function loadPlatformPayments(filters?: { status?: string; workspaceId?: string; from?: string; to?: string }) {
  await requirePlatform();
  const supabase = await createClient();
  let query = supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(1000);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.workspaceId) query = query.eq("workspace_id", filters.workspaceId);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const { data: invoices } = await query;
  const rows = invoices || [];
  const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
  const invoiceIds = rows.map((row) => row.id);
  const [{ data: workspaces }, { data: payments }] = await Promise.all([
    workspaceIds.length
      ? supabase.from("workspaces").select("id, name").in("id", workspaceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    invoiceIds.length
      ? supabase.from("payments").select("invoice_id, channel, sepay_id, amount, created_at").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as { invoice_id: string; channel: string; sepay_id: string; amount: number; created_at: string }[] }),
  ]);
  const names = new Map((workspaces || []).map((row) => [row.id, row.name]));
  return rows.map((invoice) => ({
    ...invoice,
    workspaceName: names.get(invoice.workspace_id) || "Unknown workspace",
    payments: (payments || []).filter((payment) => payment.invoice_id === invoice.id),
  }));
}

export async function lockWorkspaceAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const locked = String(formData.get("locked") || "") === "true";
  const next = !locked;
  await supabase.from("workspaces").update({ locked: next }).eq("id", id);
  await recordPlatformAudit({
    action: next ? "workspace.lock" : "workspace.unlock",
    entityType: "workspace",
    entityId: id,
    after: { locked: next },
  });
  revalidatePath("/app/platform/workspaces");
}

export async function syncApifyCatalogAction(formData: FormData) {
  void formData;
  await requirePlatform("super_admin");
  try {
    const result = await syncLeadGenerationStore();
    await recordPlatformAudit({
      action: "scrape_sources.sync",
      entityType: "scrape_sources",
      after: { total: result.total },
    });
    revalidatePath("/app/platform");
    revalidatePath("/app/leads/sources");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đồng bộ được catalog.";
    return { error: message };
  }
}
