"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatform } from "@/lib/auth/session";
import { parsePlan } from "@/lib/entitlements";
import { syncLeadGenerationStore } from "@/features/leads/server/sync-store";
import { recordPlatformAudit } from "@/lib/platform/audit";

export async function updatePlanAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const { data: current } = await supabase.from("plans").select("features").eq("id", id).maybeSingle();
  const currentFeatures = { ...((current?.features || {}) as Record<string, unknown>) };
  delete currentFeatures.share_no_watermark;
  delete currentFeatures.google_drive;
  delete currentFeatures.vat_invoice;
  const { error } = await supabase
    .from("plans")
    .update({
      name: String(formData.get("name") || ""),
      price_monthly: Number(formData.get("price_monthly") || 0),
      price_yearly: Number(formData.get("price_yearly") || 0),
      trial_days: Number(formData.get("trial_days") || 0),
      is_public: String(formData.get("is_public") || "") === "on",
      badge: String(formData.get("badge") || ""),
      quotas: {
        seats: Number(formData.get("seats") || 1),
        quotes_per_month: Number(formData.get("quotes_per_month") || 0),
        ai_briefs_per_month: Number(formData.get("ai_briefs_per_month") || 0),
        maps_scrapes_per_month: Number(formData.get("maps_scrapes_per_month") || 0),
        maps_places_per_month: Number(formData.get("maps_places_per_month") || 0),
        maps_people_per_month: Number(formData.get("maps_people_per_month") || 0),
      },
      features: {
        ...currentFeatures,
        byok_ai: String(formData.get("byok_ai") || "") === "on",
        lead_scrape: String(formData.get("lead_scrape") || "") === "on",
        export_docx: String(formData.get("export_docx") || "") === "on",
        custom_branding: String(formData.get("custom_branding") || "") === "on",
        contracts: String(formData.get("contracts") || "") === "on",
      },
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await recordPlatformAudit({
    action: "plan.update",
    entityType: "plan",
    entityId: id,
    after: { name: String(formData.get("name") || "") },
  });
  revalidatePath("/app/platform/plans");
  revalidatePath("/pricing");
  return { ok: true as const };
}

export async function loadPlatformPlans() {
  await requirePlatform();
  const supabase = await createClient();
  const [{ data }, { data: workspaces }] = await Promise.all([
    supabase.from("plans").select("*").order("slot"),
    supabase.from("workspaces").select("plan_id"),
  ]);
  const counts = new Map<string, number>();
  for (const workspace of workspaces || []) {
    counts.set(workspace.plan_id, (counts.get(workspace.plan_id) || 0) + 1);
  }
  return (data || []).map((row) => ({ plan: parsePlan(row), workspaceCount: counts.get(row.id) || 0 }));
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
