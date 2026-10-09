"use server";

import { revalidatePath } from "next/cache";
import { uploadLogoJpeg } from "@/lib/logo-storage";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, requireOwnerOrAdmin, requireWorkspace, requireModule } from "@/lib/auth/session";
import { clientFromRow, moduleFromRow, quoteFromRow, quoteToRow, settingsFromRow, settingsToUpdate } from "@/lib/db/mappers";
import { canUsePaidFeatures } from "@/lib/entitlements";
import { incrementUsage } from "@/lib/usage";
import { createPublicId } from "@/lib/ids";
import type { Client, CompanySettings, Quote, ServiceModule } from "@/lib/types";
import { createShareId } from "@/lib/share-id";
import { slimSharedPayload, type SharedQuotePayload } from "@/lib/share";
import { admit } from "@/lib/admission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadWorkspaceAppData(parts: Array<"settings" | "clients" | "modules" | "quotes"> = ["settings", "clients", "modules", "quotes"]) {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const [settingsRes, clientsRes, modulesRes, quotesRes] = await Promise.all([
    parts.includes("settings") ? supabase.from("workspace_settings").select("*").eq("workspace_id", context.workspaceId).single() : { data: null },
    parts.includes("clients") ? supabase.from("clients").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }) : { data: [] },
    parts.includes("modules") ? supabase.from("modules").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: true }) : { data: [] },
    parts.includes("quotes") ? supabase.from("quotes").select("*").eq("workspace_id", context.workspaceId).order("updated_at", { ascending: false }) : { data: [] },
  ]);

  return {
    context,
    settings: settingsRes.data ? settingsFromRow(settingsRes.data) : null,
    clients: (clientsRes.data || []).map(clientFromRow),
    modules: (modulesRes.data || []).map(moduleFromRow),
    quotes: (quotesRes.data || []).map(quoteFromRow),
  };
}

export async function saveSettingsAction(settings: CompanySettings) {
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  if (!context.plan.features.custom_branding) {
    const { data: current } = await supabase
      .from("workspace_settings")
      .select("logo_path, accent_color")
      .eq("workspace_id", context.workspaceId)
      .single();
    if (current && (settings.logoPath !== current.logo_path || settings.accentColor !== current.accent_color)) {
      return { error: "Gói hiện tại không gồm tùy chỉnh thương hiệu." };
    }
  }
  const { error } = await supabase
    .from("workspace_settings")
    .update(settingsToUpdate(settings))
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  revalidatePath("/app/quotes");
  return { ok: true as const };
}

export async function saveWorkspaceLogoAction(dataUrl: string) {
  const context = await requireOwnerOrAdmin();
  if (!context.plan.features.custom_branding) {
    return { error: "Gói hiện tại không gồm tùy chỉnh thương hiệu." };
  }
  const supabase = await createClient();
  let logoPath = "";
  if (dataUrl) {
    const stored = await uploadLogoJpeg(supabase, `${context.workspaceId}/branding.jpg`, dataUrl);
    if ("error" in stored) return { error: stored.error };
    logoPath = stored.url;
  }
  const { error } = await supabase.from("workspace_settings").update({ logo_path: logoPath }).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { url: logoPath };
}

export async function createClientAction(input: Omit<Client, "id" | "createdAt">) {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: context.workspaceId,
      company_name: input.companyName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone || "",
      tax_code: input.taxCode || "",
      address: input.address || "",
      representative_title: input.representativeTitle || "",
      authorization_doc: input.authorizationDoc || "",
      logo_url: input.logoUrl || "",
      industry: input.industry || "",
      notes: input.notes || "",
    })
    .select("*")
    .single();
  if (error || !data) return { error: error?.message || "Không lưu được khách hàng." };
  revalidatePath("/app/clients");
  return { ok: true as const, client: clientFromRow(data) };
}

export async function updateClientLogoAction(clientId: string, logoUrl: string) {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ logo_url: logoUrl })
    .eq("id", clientId)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/clients");
  return { ok: true as const };
}

export async function createModuleAction(input: Pick<ServiceModule, "name" | "description" | "suggestedPrice">) {
  await requireModule("product_modules"); // createModuleAction
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("modules").insert({
    workspace_id: context.workspaceId,
    name: input.name,
    description: input.description,
    suggested_price: input.suggestedPrice,
    category: "Product",
    default_qty: 1,
    visual_hint: "Custom module",
  });
  if (error) return { error: error.message };
  revalidatePath("/app/modules");
  return { ok: true as const };
}

export async function saveQuoteAction(quote: Quote) {
  await requireModule("quotes"); // saveQuoteAction
  const context = await requireWorkspace();
  if (!canUsePaidFeatures(context.planStatus) || context.locked) {
    return { error: "Gói đã hết hạn. Hãy gia hạn để tiếp tục tạo/sửa báo giá." };
  }

  const supabase = await createClient();
  const row = quoteToRow(quote, context.workspaceId);
  const now = new Date().toISOString();
  if (quote.status === "sent") {
    row.quote_status_v2 = "sent";
    row.sent_at = now;
  }
  if (quote.status === "won") {
    row.quote_status_v2 = "accepted";
    row.accepted_at = now;
  }
  if (quote.status === "lost") {
    row.quote_status_v2 = "rejected";
    row.rejected_at = now;
  }
  const { error } = await supabase.from("quotes").upsert(row, { onConflict: "id" });
  if (error?.message?.includes("quote_monthly_limit")) {
    return { error: `Đã đạt giới hạn ${context.plan.quotas.quotes_per_month} báo giá trong tháng.` };
  }
  if (error) return { error: error.message };
  if (quote.dealId) {
    revalidatePath(`/app/deals/${quote.dealId}`);
  }
  revalidatePath("/app");
  revalidatePath("/app/quotes");
  return { ok: true as const };
}

export async function deleteQuoteAction(quoteId: string) {
  await requireModule("quotes"); // deleteQuoteAction
  const context = await requireWorkspace();
  const id = quoteId.trim();
  if (!id) return { error: "Không thấy quote." };
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, deal_id")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!quote) return { error: "Không thấy quote." };
  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  if (quote.deal_id) revalidatePath(`/app/deals/${quote.deal_id}`);
  revalidatePath("/app");
  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${id}`);
  return { ok: true as const };
}

export async function createShareAction(payload: unknown) {
  await requireModule("quotes"); // createShareAction
  const context = await requireWorkspace();
  const supabase = await createClient();
  if (!payload || typeof payload !== "object" || !("settings" in payload) || !("quote" in payload)) {
    return { error: "Dữ liệu chia sẻ không hợp lệ." };
  }
  const safePayload = slimSharedPayload(payload as SharedQuotePayload, { stripDataLogos: false });
  if (Buffer.byteLength(JSON.stringify(safePayload), "utf8") > 512_000) {
    return { error: "Quote quá lớn để tạo link chia sẻ." };
  }
  const gate = await admit(createAdminClient(), context.userId, "share_create", 20, 60);
  if ("error" in gate) return { error: gate.error };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createShareId();
    const { error } = await supabase.from("public_quotes").insert({
      id,
      workspace_id: context.workspaceId,
      payload: safePayload as never,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    if (!error) return { id, url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/p/${id}` };
  }
  return { error: "Không tạo được link chia sẻ." };
}

export async function consumeAiQuotaAction() {
  const context = await requireWorkspace();
  if (!canUsePaidFeatures(context.planStatus) || context.locked) {
    return { error: "Gói đã hết hạn." };
  }
  const supabase = await createClient();
  return incrementUsage(supabase, context.workspaceId, "ai_briefs", 1, context.plan.quotas.ai_briefs_per_month);
}

export async function importLocalDataAction(raw: string) {
  const context = await requireOwner();
  let parsed: { clients?: Client[]; quotes?: Quote[]; modules?: ServiceModule[]; settings?: CompanySettings };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { error: "JSON không hợp lệ." };
  }
  if ((parsed.clients?.length || 0) > 0 || (parsed.quotes?.length || 0) > 0) {
    await requireModule("quotes");
  }
  if ((parsed.modules?.length || 0) > 0) {
    await requireModule("product_modules");
  }
  const supabase = await createClient();
  if (parsed.settings) {
    if (!context.plan.features.custom_branding) {
      const { data: current } = await supabase
        .from("workspace_settings")
        .select("logo_path, accent_color")
        .eq("workspace_id", context.workspaceId)
        .single();
      if (current && (parsed.settings.logoPath !== current.logo_path || parsed.settings.accentColor !== current.accent_color)) {
        return { error: "Dữ liệu nhập có tùy chỉnh thương hiệu không thuộc gói hiện tại." };
      }
    }
    const { error } = await supabase.from("workspace_settings").update(settingsToUpdate(parsed.settings)).eq("workspace_id", context.workspaceId);
    if (error) return { error: error.message };
  }
  for (const client of parsed.clients || []) {
    const { error } = await supabase.from("clients").upsert({
      id: client.id,
      workspace_id: context.workspaceId,
      company_name: client.companyName,
      contact_name: client.contactName,
      email: client.email,
      phone: client.phone || "",
      tax_code: client.taxCode || "",
      address: client.address || "",
      representative_title: client.representativeTitle || "",
      authorization_doc: client.authorizationDoc || "",
      logo_url: client.logoUrl || "",
      industry: client.industry || "",
      notes: client.notes || "",
      created_at: client.createdAt,
    });
    if (error) return { error: error.message };
  }
  for (const serviceModule of parsed.modules || []) {
    const { error } = await supabase.from("modules").upsert({
      id: serviceModule.id,
      workspace_id: context.workspaceId,
      name: serviceModule.name,
      description: serviceModule.description,
      suggested_price: serviceModule.suggestedPrice,
      category: serviceModule.category,
      default_qty: serviceModule.defaultQty,
      visual_hint: serviceModule.visualHint,
    });
    if (error) return { error: error.message };
  }
  for (const quote of parsed.quotes || []) {
    const { error } = await supabase.from("quotes").upsert(quoteToRow(quote, context.workspaceId));
    if (error?.message?.includes("quote_monthly_limit")) {
      return { error: `Đã đạt giới hạn ${context.plan.quotas.quotes_per_month} báo giá trong tháng.` };
    }
    if (error) return { error: error.message };
  }
  revalidatePath("/app");
  return { ok: true as const };
}

export { createPublicId };
