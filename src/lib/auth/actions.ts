"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { addDays, addMonths, createToken, hashToken, slugify } from "@/lib/crypto-utils";
import { getSessionContext, requireOwner, requireOwnerOrAdmin } from "@/lib/auth/session";
import { parsePlan } from "@/lib/entitlements";
import { defaultSettings } from "@/lib/default-data";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function safeInternalNext(value: FormDataEntryValue | string | null | undefined) {
  const next = String(value || "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const inviteToken = String(formData.get("invite") || "");
  if (!email || password.length < 8) {
    return { error: "Email và mật khẩu (tối thiểu 8 ký tự) là bắt buộc." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };

  if (data.session) {
    if (inviteToken) {
      const accepted = await acceptInvite(inviteToken);
      if (accepted.error) return accepted;
      redirect("/app");
    }
    redirect("/onboarding");
  }

  return { error: "Hãy kiểm tra email để xác nhận tài khoản, rồi đăng nhập." };
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const context = await getSessionContext();
  if (!context || context.kind === "onboarding") {
    const bootstrap = await maybeBootstrapPlatform(email);
    if (bootstrap) redirect("/app/platform/plans");
    redirect("/onboarding");
  }
  if (context.kind === "platform") redirect("/app/platform/plans");
  const next = safeInternalNext(formData.get("next"));
  if (next) redirect(next);
  redirect("/app");
}

export async function signInWithGoogle(inviteToken?: string, requestedNext?: string) {
  const supabase = await createClient();
  const next = inviteToken ? `/invite/${inviteToken}` : safeInternalNext(requestedNext) || "/app";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return { error: error?.message || "Không khởi tạo được Google login." };
  redirect(data.url);
}

export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/login`,
  });
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function maybeBootstrapPlatform(email: string) {
  const bootstrap = process.env.PLATFORM_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!bootstrap || email.trim().toLowerCase() !== bootstrap || !hasServiceRole()) return false;

  const admin = createAdminClient();
  const { count } = await admin.from("platform_admins").select("user_id", { count: "exact", head: true });
  if ((count || 0) > 0) return false;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;

  const { data: member } = await admin.from("workspace_members").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (member) return false;

  const { error } = await admin.from("platform_admins").insert({ user_id: data.user.id, role: "super_admin" });
  return !error;
}

export async function createWorkspaceAction(formData: FormData) {
  if (!(await isPlatformFlagEnabled("signup_enabled"))) {
    return { error: "Đăng ký workspace mới đang tạm dừng." };
  }
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (context.kind !== "onboarding") {
    redirect(context.kind === "platform" ? "/app/platform/plans" : "/app");
  }

  const type = String(formData.get("type") || "") === "company" ? "company" : "personal";
  const name = String(formData.get("name") || "").trim();
  const planId = String(formData.get("planId") || "");
  if (!name) return { error: "Tên workspace là bắt buộc." };

  const supabase = await createClient();
  const { data: planRow } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!planRow) return { error: "Gói không hợp lệ." };
  const plan = parsePlan(planRow);

  const workspaceId = crypto.randomUUID();
  const slug = slugify(name);
  const { error: wsError } = await supabase.from("workspaces").insert({
    id: workspaceId,
    type,
    name,
    slug,
    plan_id: plan.id,
    plan_status: plan.isFree ? "active" : plan.trialDays > 0 ? "trialing" : "past_due",
  });
  if (wsError) return { error: wsError.message };

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: context.userId,
    role: "owner",
  });
  if (memberError) return { error: memberError.message };

  const settings = type === "company" ? defaultSettings : {
    ...defaultSettings,
    companyName: name,
    shortName: name,
    taxCode: "",
    legalRepresentative: "",
    legalRepresentativeTitle: "",
    bankAccountName: name,
    contractNumberPrefix: "HDDV",
  };

  await supabase.from("workspace_settings").insert({
    workspace_id: workspaceId,
    company_name: settings.companyName,
    short_name: settings.shortName,
    tax_code: settings.taxCode,
    address: settings.address,
    email: context.email,
    phone: settings.phone,
    website: settings.website,
    logo_path: settings.logoPath,
    accent_color: settings.accentColor,
    vat_rate: settings.vatRate,
    quote_validity_days: settings.quoteValidityDays,
    about: settings.about,
    terms: settings.terms,
    legal_representative: settings.legalRepresentative,
    legal_representative_title: settings.legalRepresentativeTitle,
    bank_account_number: settings.bankAccountNumber,
    bank_account_name: settings.bankAccountName,
    bank_name: settings.bankName,
    contract_number_prefix: settings.contractNumberPrefix,
    default_warranty_months: settings.defaultWarrantyMonths,
    default_maintenance_fee: settings.defaultMaintenanceFee,
  });

  const { data: templates } = await supabase.from("module_templates").select("*").order("sort_order");
  if (templates?.length) {
    await supabase.from("modules").insert(
      templates.map((template) => ({
        workspace_id: workspaceId,
        name: template.name,
        category: template.category,
        description: template.description,
        suggested_price: template.suggested_price,
        default_qty: template.default_qty,
        visual_hint: template.visual_hint,
      })),
    );
  }

  const periodEnd = plan.isFree
    ? addMonths(new Date(), 120)
    : addDays(new Date(), Math.max(plan.trialDays, 1));

  await supabase.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan_id: plan.id,
    status: plan.isFree ? "active" : "trialing",
    billing_interval: "monthly",
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  if (!plan.isFree) redirect("/app/billing");
  redirect("/app");
}

export async function convertToCompanyAction() {
  const supabase = await createClient();
  const context = await getSessionContext();
  if (!context || context.kind !== "workspace" || context.memberRole !== "owner") {
    return { error: "Chỉ owner workspace cá nhân mới nâng lên công ty." };
  }
  if (context.workspaceType === "company") return { error: "Workspace đã là công ty." };
  const { error } = await supabase.from("workspaces").update({ type: "company" }).eq("id", context.workspaceId);
  if (error) return { error: error.message };
  redirect("/app/team");
}

export async function createInviteAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context || context.kind !== "workspace" || context.memberRole === "member") {
    return { error: "Không có quyền mời thành viên." };
  }
  if (context.workspaceType !== "company") {
    return { error: "Hãy nâng workspace lên công ty trước khi mời team." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member") === "admin" ? "admin" : "member";
  if (!email) return { error: "Email là bắt buộc." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", context.workspaceId);
  if (quotaSeatsReached(count || 0, context.plan.quotas.seats)) {
    return { error: "Đã hết số chỗ ngồi của gói hiện tại." };
  }

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existingProfile) {
    const { data: taken } = await supabase.from("workspace_members").select("user_id").eq("user_id", existingProfile.id).maybeSingle();
    const { data: platform } = await supabase.from("platform_admins").select("user_id").eq("user_id", existingProfile.id).maybeSingle();
    if (taken || platform) return { error: "Account này đã thuộc workspace khác hoặc đã có role nền tảng. Hãy dùng email khác." };
  }

  const token = createToken();
  const { error } = await supabase.from("invites").insert({
    workspace_id: context.workspaceId,
    email,
    role,
    token_hash: hashToken(token),
    invited_by: context.userId,
    expires_at: addDays(new Date(), 7).toISOString(),
  });
  if (error) return { error: error.message };

  return { ok: true as const, url: `${siteUrl()}/invite/${token}` };
}

function quotaSeatsReached(used: number, limit: number) {
  if (limit < 0) return false;
  return used >= limit;
}

export async function acceptInvite(rawToken: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Hãy đăng nhập hoặc đăng ký bằng đúng email được mời." };
  if (context.kind !== "onboarding") {
    return { error: "Account này đã có role. Một account chỉ được 1 role — hãy dùng email khác." };
  }

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("invites")
    .select("*")
    .eq("token_hash", hashToken(rawToken))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!invite) return { error: "Invite không hợp lệ hoặc đã hết hạn." };
  if (invite.email.trim().toLowerCase() !== context.email.trim().toLowerCase()) {
    return { error: "Hãy đăng nhập bằng đúng email được mời." };
  }

  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: invite.workspace_id,
    user_id: context.userId,
    role: invite.role,
  });
  if (error) return { error: error.message };

  await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  return { ok: true as const };
}

export async function acceptPlatformInvite(rawToken: string) {
  const context = await getSessionContext();
  if (!context) return { error: "Hãy đăng nhập bằng email được mời." };
  if (context.kind !== "onboarding") {
    return { error: "Account này đã có role." };
  }

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("platform_invites")
    .select("*")
    .eq("token_hash", hashToken(rawToken))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!invite) return { error: "Invite không hợp lệ hoặc đã hết hạn." };
  if (invite.email.trim().toLowerCase() !== context.email.trim().toLowerCase()) {
    return { error: "Hãy đăng nhập bằng đúng email được mời." };
  }

  const { error } = await supabase.from("platform_admins").insert({
    user_id: context.userId,
    role: invite.role,
    created_by: invite.invited_by,
  });
  if (error) return { error: error.message };
  await supabase.from("platform_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  return { ok: true as const };
}

export async function createPlatformInviteAction(formData: FormData) {
  const context = await getSessionContext();
  if (!context || context.kind !== "platform" || context.platformRole !== "super_admin") {
    return { error: "Chỉ super admin mới mời được." };
  }
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "support") === "super_admin" ? "super_admin" : "support";
  if (!email) return { error: "Email là bắt buộc." };

  const supabase = await createClient();
  const token = createToken();
  const { error } = await supabase.from("platform_invites").insert({
    email,
    role,
    token_hash: hashToken(token),
    invited_by: context.userId,
    expires_at: addDays(new Date(), 7).toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/platform/accounts");
  return { ok: true as const, url: `${siteUrl()}/invite/${token}?kind=platform` };
}

export async function removeMemberAction(formData: FormData) {
  const context = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const userId = String(formData.get("userId") || "");
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: context.workspaceId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/team");
  return { ok: true as const };
}

export async function transferOwnerAction(formData: FormData) {
  const context = await requireOwner();
  const supabase = await createClient();
  const userId = String(formData.get("userId") || "");
  const { error } = await supabase.rpc("transfer_workspace_owner", {
    p_workspace_id: context.workspaceId,
    p_new_owner: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/team");
  return { ok: true as const };
}

export async function setMemberRoleAction(formData: FormData) {
  const context = await requireOwner();
  const supabase = await createClient();
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "") === "admin" ? "admin" : "member";
  const { error } = await supabase.rpc("set_workspace_member_role", {
    p_workspace_id: context.workspaceId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/team");
  return { ok: true as const };
}
