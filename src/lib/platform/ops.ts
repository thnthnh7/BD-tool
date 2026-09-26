"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/auth/session";
import { applySepayPayment, runBillingCron } from "@/lib/billing/actions";
import { restoredPlanStatus } from "@/lib/billing/plan-access";
import { currentPeriod } from "@/lib/crypto-utils";
import { applyPlanOverrides, parsePlan, type PlanQuotas } from "@/lib/entitlements";
import { setLoginBan } from "@/lib/platform/access";
import { recordPlatformAudit } from "@/lib/platform/audit";

const QUOTA_KEYS: (keyof PlanQuotas)[] = [
  "seats",
  "quotes_per_month",
  "ai_briefs_per_month",
  "maps_scrapes_per_month",
  "maps_places_per_month",
  "maps_people_per_month",
];

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function loadPlatformDashboard() {
  await requirePlatform();
  const supabase = await createClient();
  const period = currentPeriod();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = monthStartIso();
  const pendingCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const failedSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const [{ data: workspaces }, { data: invoices }, { data: payments }, { data: usage }, { data: jobs }, { data: plans }, { data: overrides }] =
    await Promise.all([
      supabase.from("workspaces").select("id, name, plan_id, plan_status, locked, archived_at, created_at"),
      supabase.from("invoices").select("id, workspace_id, amount, status, created_at, paid_at"),
      supabase.from("payments").select("amount, created_at"),
      supabase.from("usage_counters").select("*").eq("period", period),
      supabase.from("lead_scrape_jobs").select("id, workspace_id, status, error_message, updated_at"),
      supabase.from("plans").select("*"),
      supabase.from("workspace_overrides").select("workspace_id, quotas, features"),
    ]);

  const tenantRows = workspaces || [];
  const statusCounts = { trialing: 0, active: 0, past_due: 0, expired: 0, canceled: 0 };
  for (const row of tenantRows) {
    if (row.plan_status in statusCounts) statusCounts[row.plan_status as keyof typeof statusCounts] += 1;
  }
  const lockedCount = tenantRows.filter((row) => row.locked).length;
  const newCount = tenantRows.filter((row) => row.created_at >= weekAgo).length;

  const invoiceRows = invoices || [];
  const paidThisMonth = invoiceRows.filter((row) => row.status === "paid" && row.paid_at && row.paid_at >= monthStart);
  const pending = invoiceRows.filter((row) => row.status === "pending");
  const pendingOld = pending.filter((row) => row.created_at < pendingCutoff);
  const collected = (payments || []).filter((row) => row.created_at >= monthStart).reduce((sum, row) => sum + row.amount, 0);

  const planById = new Map((plans || []).map((row) => [row.id, parsePlan(row)]));
  const overrideByWorkspace = new Map((overrides || []).map((row) => [row.workspace_id, row]));
  const usageTotals = { quotes_created: 0, ai_briefs: 0, maps_scrapes: 0, maps_places: 0, maps_people: 0 };
  const nearQuota: { id: string; name: string; field: string; used: number; limit: number }[] = [];
  for (const row of usage || []) {
    usageTotals.quotes_created += row.quotes_created;
    usageTotals.ai_briefs += row.ai_briefs;
    usageTotals.maps_scrapes += row.maps_scrapes;
    usageTotals.maps_places += row.maps_places;
    usageTotals.maps_people += row.maps_people;
    const workspace = tenantRows.find((item) => item.id === row.workspace_id);
    const plan = workspace ? planById.get(workspace.plan_id) : undefined;
    if (!workspace || !plan) continue;
    const override = overrideByWorkspace.get(workspace.id);
    const effective = applyPlanOverrides(plan, override?.quotas, override?.features);
    const used: Record<string, number> = {
      quotes_per_month: row.quotes_created,
      ai_briefs_per_month: row.ai_briefs,
      maps_scrapes_per_month: row.maps_scrapes,
      maps_places_per_month: row.maps_places,
      maps_people_per_month: row.maps_people,
    };
    for (const key of Object.keys(used)) {
      const limit = effective.quotas[key as keyof PlanQuotas];
      if (limit > 0 && used[key] / limit >= 0.8) {
        nearQuota.push({ id: workspace.id, name: workspace.name, field: key, used: used[key], limit });
      }
    }
  }

  const jobRows = jobs || [];
  const scrapeCounts = { queued: 0, running: 0, ingesting: 0, failed: 0, succeeded: 0 };
  for (const job of jobRows) {
    if (job.status in scrapeCounts) scrapeCounts[job.status as keyof typeof scrapeCounts] += 1;
  }
  const failedRecent = jobRows.filter((job) => job.status === "failed" && job.updated_at >= failedSince);
  const stuck = jobRows.filter((job) => (job.status === "running" || job.status === "ingesting") && job.updated_at < stuckBefore);

  const names = new Map(tenantRows.map((row) => [row.id, row.name]));
  const attention = [
    ...tenantRows.filter((row) => row.plan_status === "past_due").map((row) => ({ href: `/app/platform/workspaces/${row.id}`, label: row.name, detail: "past due" })),
    ...tenantRows.filter((row) => row.locked).map((row) => ({ href: `/app/platform/workspaces/${row.id}`, label: row.name, detail: "locked" })),
    ...pendingOld.map((row) => ({ href: `/app/platform/workspaces/${row.workspace_id}`, label: names.get(row.workspace_id) || row.workspace_id, detail: "pending invoice" })),
    ...failedRecent.map((job) => ({ href: `/app/platform/workspaces/${job.workspace_id}`, label: names.get(job.workspace_id) || job.workspace_id, detail: job.error_message || "scrape failed" })),
  ].slice(0, 20);

  return { statusCounts, lockedCount, newCount, pendingCount: pending.length, paidCount: paidThisMonth.length, paidAmount: paidThisMonth.reduce((sum, row) => sum + row.amount, 0), collected, usageTotals, nearQuota, scrapeCounts, failedRecent: failedRecent.length, stuck: stuck.length, attention };
}

export async function loadPlatformAccounts(query: string) {
  await requirePlatform();
  const supabase = await createClient();
  let profilesQuery = supabase.from("profiles").select("id, email, display_name, status, deleted_at, created_at").order("created_at", { ascending: false }).limit(200);
  if (query) profilesQuery = profilesQuery.ilike("email", `%${query}%`);
  const [{ data: profiles }, { data: members }, { data: admins }, { data: workspaces }, { data: plans }, { data: invites }, { data: platformInvites }] = await Promise.all([
    profilesQuery,
    supabase.from("workspace_members").select("user_id, workspace_id, role"),
    supabase.from("platform_admins").select("user_id, role"),
    supabase.from("workspaces").select("id, name, plan_id, plan_status, plan_deactivated_at, plan_deactivation_reason"),
    supabase.from("plans").select("id, name"),
    supabase.from("invites").select("id, email, role, workspace_id, expires_at, accepted_at").is("accepted_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("platform_invites").select("id, email, role, expires_at, accepted_at").is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);

  const lastSignIn = new Map<string, string | null>();
  if (hasServiceRole()) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of data?.users || []) lastSignIn.set(user.id, user.last_sign_in_at || null);
  }

  const workspaceNames = new Map((workspaces || []).map((row) => [row.id, row.name]));
  const workspaceById = new Map((workspaces || []).map((row) => [row.id, row]));
  const planNames = new Map((plans || []).map((row) => [row.id, row.name]));
  const accounts = (profiles || []).map((profile) => {
    const member = (members || []).find((row) => row.user_id === profile.id);
    const platform = (admins || []).find((row) => row.user_id === profile.id);
    const role = platform?.role || member?.role || "onboarding";
    const workspace = member ? workspaceById.get(member.workspace_id) : undefined;
    return {
      ...profile,
      role,
      workspaceId: member?.workspace_id || null,
      workspaceName: member ? workspaceNames.get(member.workspace_id) || "" : "",
      planName: workspace ? planNames.get(workspace.plan_id) || "" : "",
      planStatus: workspace?.plan_status || null,
      planDeactivatedAt: workspace?.plan_deactivated_at || null,
      planDeactivationReason: workspace?.plan_deactivation_reason || null,
      lastSignIn: lastSignIn.get(profile.id) || null,
    };
  });

  return {
    accounts,
    invites: (invites || []).map((invite) => ({ ...invite, workspaceName: workspaceNames.get(invite.workspace_id) || "" })),
    platformInvites: platformInvites || [],
  };
}

export async function loadPlatformStaff() {
  const context = await requirePlatform("super_admin");
  const supabase = await createClient();
  const [{ data: admins }, { data: invites }] = await Promise.all([
    supabase.from("platform_admins").select("user_id, role, created_at"),
    supabase.from("platform_invites").select("id, email, role, expires_at, accepted_at").is("accepted_at", null),
  ]);
  const ids = (admins || []).map((row) => row.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  return {
    actorId: context.userId,
    admins: (admins || []).map((row) => ({
      ...row,
      email: profiles?.find((profile) => profile.id === row.user_id)?.email || "",
      displayName: profiles?.find((profile) => profile.id === row.user_id)?.display_name || "",
    })),
    invites: invites || [],
  };
}

async function guardSuspend(actorRole: "super_admin" | "support", userId: string) {
  const admin = createAdminClient();
  const { data: platform } = await admin.from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  if (!platform) return null;
  if (actorRole !== "super_admin") return "Only a super admin can suspend platform staff.";
  if (platform.role === "super_admin") {
    const { count } = await admin.from("platform_admins").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count || 0) <= 1) return "Cannot suspend the last super admin.";
  }
  return null;
}

export async function setAccountStatusAction(formData: FormData) {
  const context = await requirePlatform();
  if (!hasServiceRole()) return { error: "Missing service role" };
  const userId = String(formData.get("userId") || "");
  const mode = String(formData.get("mode") || "");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, email, status, deleted_at").eq("id", userId).maybeSingle();
  if (!profile) return { error: "Account not found." };
  const { data: member } = await admin.from("workspace_members").select("role").eq("user_id", userId).maybeSingle();

  if (mode === "suspend" || mode === "soft_delete") {
    if (member?.role === "owner") return { error: "Transfer ownership before disabling the owner." };
    const blocked = await guardSuspend(context.platformRole, userId);
    if (blocked) return { error: blocked };
    const status = mode === "soft_delete" ? "deleted" : "suspended";
    const { error } = await admin
      .from("profiles")
      .update({
        status,
        suspend_source: "admin",
        deleted_at: status === "deleted" ? new Date().toISOString() : null,
      })
      .eq("id", userId);
    if (error) return { error: error.message };
    const banError = await setLoginBan(userId, true);
    if (banError) return { error: banError };
    await recordPlatformAudit({ action: mode === "soft_delete" ? "account.soft_delete" : "account.suspend", entityType: "user", entityId: userId, after: { status } });
  } else if (mode === "restore") {
    if (profile.status === "deleted") {
      if (!profile.deleted_at || Date.now() - new Date(profile.deleted_at).getTime() > 30 * 24 * 60 * 60 * 1000) {
        return { error: "The restore window has passed." };
      }
      if (profile.email.startsWith("deleted+")) return { error: "This account has been anonymized." };
    }
    const { error } = await admin.from("profiles").update({ status: "active", suspend_source: null, deleted_at: null }).eq("id", userId);
    if (error) return { error: error.message };
    const banError = await setLoginBan(userId, false);
    if (banError) return { error: banError };
    await recordPlatformAudit({ action: "account.restore", entityType: "user", entityId: userId, after: { status: "active" } });
  } else {
    return { error: "Unknown action." };
  }

  revalidatePath("/app/platform/accounts");
  return { ok: true as const };
}

export async function hardDeleteAccountAction(formData: FormData) {
  await requirePlatform("super_admin");
  if (!hasServiceRole()) return { error: "Missing service role" };
  const userId = String(formData.get("userId") || "");
  const confirm = String(formData.get("confirm") || "").trim().toLowerCase();
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email, status").eq("id", userId).maybeSingle();
  if (!profile) return { error: "Account not found." };
  if (profile.status !== "deleted") return { error: "Soft-delete the account first." };
  if (profile.email.trim().toLowerCase() !== confirm) return { error: "Type the account email to confirm." };
  const { data: member } = await admin.from("workspace_members").select("role").eq("user_id", userId).maybeSingle();
  if (member?.role === "owner") return { error: "Transfer ownership before deleting this account." };
  await recordPlatformAudit({ action: "account.hard_delete", entityType: "user", entityId: userId, before: { email: profile.email } });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/app/platform/accounts");
  return { ok: true as const };
}

export async function sendPasswordResetAction(formData: FormData) {
  await requirePlatform("super_admin");
  if (!hasServiceRole()) return { error: "Missing service role" };
  const email = String(formData.get("email") || "").trim();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/login` },
  });
  if (error || !data.properties?.action_link) return { error: error?.message || "Could not create a reset link." };
  return { ok: true as const, url: data.properties.action_link };
}

export async function revokeInviteAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "");
  const { error } = kind === "platform"
    ? await supabase.from("platform_invites").delete().eq("id", id).is("accepted_at", null)
    : await supabase.from("invites").delete().eq("id", id).is("accepted_at", null);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "invite.revoke", entityType: kind === "platform" ? "platform_invite" : "invite", entityId: id });
  revalidatePath("/app/platform/accounts");
  revalidatePath("/app/platform/plans");
  return { ok: true as const };
}

export async function setPlatformRoleAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "") === "support" ? "support" : "super_admin";
  const { error } = await supabase.from("platform_admins").update({ role }).eq("user_id", userId);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "platform_admin.role", entityType: "user", entityId: userId, after: { role } });
  revalidatePath("/app/platform/accounts");
  revalidatePath("/app/platform/plans");
  return { ok: true as const };
}

export async function removePlatformAdminAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const userId = String(formData.get("userId") || "");
  const { error } = await supabase.from("platform_admins").delete().eq("user_id", userId);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "platform_admin.remove", entityType: "user", entityId: userId });
  revalidatePath("/app/platform/accounts");
  revalidatePath("/app/platform/plans");
  return { ok: true as const };
}

export async function loadWorkspaceDetail(workspaceId: string) {
  await requirePlatform();
  const supabase = await createClient();
  const { data: workspace } = await supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle();
  if (!workspace) return null;
  const [{ data: subscription }, { data: planRow }, { data: override }, { data: members }, { data: usage }, { data: notes }, { data: shares }, { data: providers }, counts] =
    await Promise.all([
      supabase.from("subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("plans").select("*").eq("id", workspace.plan_id).maybeSingle(),
      supabase.from("workspace_overrides").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspaceId),
      supabase.from("usage_counters").select("*").eq("workspace_id", workspaceId).eq("period", currentPeriod()).maybeSingle(),
      supabase.from("workspace_notes").select("id, body, created_at, author_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("public_quotes").select("id, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("workspace_ai_providers").select("provider, model, status, last_tested_at, encrypted_api_key").eq("workspace_id", workspaceId),
      supabase.rpc("platform_workspace_counts", { p_workspace_id: workspaceId }),
    ]);
  const ids = (members || []).map((row) => row.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, status").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const plan = planRow ? applyPlanOverrides(parsePlan(planRow), override?.quotas, override?.features) : null;
  return {
    workspace,
    subscription,
    plan,
    override,
    usage,
    notes: notes || [],
    shares: shares || [],
    counts: (counts || {}) as { companies?: number; contacts?: number; leads?: number; deals?: number; quotes?: number },
    members: (members || []).map((member) => ({
      ...member,
      email: profiles?.find((profile) => profile.id === member.user_id)?.email || "",
      displayName: profiles?.find((profile) => profile.id === member.user_id)?.display_name || "",
      status: profiles?.find((profile) => profile.id === member.user_id)?.status || "active",
    })),
    byok: (providers || []).map((provider) => ({
      provider: provider.provider,
      model: provider.model,
      status: provider.status,
      lastTestedAt: provider.last_tested_at,
      hasKey: Boolean(provider.encrypted_api_key),
    })),
  };
}

export async function platformMemberAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const workspaceId = String(formData.get("workspaceId") || "");
  const userId = String(formData.get("userId") || "");
  const mode = String(formData.get("mode") || "");
  const role = String(formData.get("role") || "") === "admin" ? "admin" : "member";
  const { error } =
    mode === "remove"
      ? await supabase.rpc("remove_workspace_member", { p_workspace_id: workspaceId, p_user_id: userId })
      : mode === "transfer"
        ? await supabase.rpc("transfer_workspace_owner", { p_workspace_id: workspaceId, p_new_owner: userId })
        : await supabase.rpc("set_workspace_member_role", { p_workspace_id: workspaceId, p_user_id: userId, p_role: role });
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: `member.${mode || "role"}`, entityType: "user", entityId: userId, after: { workspaceId, role } });
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  return { ok: true as const };
}

export async function saveWorkspaceNoteAction(formData: FormData) {
  const context = await requirePlatform();
  const supabase = await createClient();
  const workspaceId = String(formData.get("workspaceId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Note is empty." };
  const { error } = await supabase.from("workspace_notes").insert({ workspace_id: workspaceId, body, author_id: context.userId });
  if (error) return { error: error.message };
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  return { ok: true as const };
}

export async function updateWorkspaceBillingAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const workspaceId = String(formData.get("workspaceId") || "");
  const planId = String(formData.get("planId") || "");
  const planStatus = String(formData.get("planStatus") || "");
  const periodEnd = String(formData.get("periodEnd") || "");
  const interval = String(formData.get("interval") || "") === "yearly" ? "yearly" : "monthly";
  const allowed = ["trialing", "active", "past_due", "expired", "canceled"];
  if (!allowed.includes(planStatus)) return { error: "Invalid plan status." };
  const { data: accessLock } = await supabase.from("workspaces")
    .select("plan_deactivated_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (accessLock?.plan_deactivated_at && planStatus !== "canceled") {
    return { error: "Reactivate plan access before changing its billing status." };
  }
  const { error: workspaceError } = await supabase.from("workspaces").update({ plan_id: planId, plan_status: planStatus }).eq("id", workspaceId);
  if (workspaceError) return { error: workspaceError.message };
  const subscriptionPatch: { plan_id: string; status: string; billing_interval: string; current_period_end?: string } = {
    plan_id: planId,
    status: planStatus,
    billing_interval: interval,
  };
  if (periodEnd) subscriptionPatch.current_period_end = new Date(periodEnd).toISOString();
  const { error: subError } = await supabase.from("subscriptions").update(subscriptionPatch).eq("workspace_id", workspaceId);
  if (subError) return { error: subError.message };
  await recordPlatformAudit({
    action: "workspace.billing",
    entityType: "workspace",
    entityId: workspaceId,
    after: { planId, planStatus, periodEnd, interval },
  });
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  return { ok: true as const };
}

export async function setWorkspacePlanActivationAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  if (!hasServiceRole()) return { error: "Missing service role" };
  const workspaceId = String(formData.get("workspaceId") || "");
  const mode = String(formData.get("mode") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!workspaceId) return { error: "Workspace is required." };
  if (mode !== "deactivate" && mode !== "reactivate") return { error: "Unknown plan action." };
  if (mode === "deactivate" && !reason) return { error: "A deactivation reason is required." };

  const admin = createAdminClient();
  const { data: workspace, error: workspaceReadError } = await admin.from("workspaces")
    .select("id, plan_id, plan_status, plan_deactivated_at, plan_deactivation_reason, plan_status_before_deactivation")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceReadError) return { error: workspaceReadError.message };
  if (!workspace) return { error: "Workspace not found." };

  let nextStatus = "canceled";
  if (mode === "reactivate") {
    const { data: subscription } = await admin.from("subscriptions")
      .select("status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    nextStatus = restoredPlanStatus(subscription?.status, workspace.plan_status_before_deactivation);
  }

  const patch = mode === "deactivate"
    ? {
        plan_status: "canceled",
        plan_deactivated_at: new Date().toISOString(),
        plan_deactivated_by: context.userId,
        plan_deactivation_reason: reason,
        plan_status_before_deactivation: workspace.plan_status,
      }
    : {
        plan_status: nextStatus,
        plan_deactivated_at: null,
        plan_deactivated_by: null,
        plan_deactivation_reason: null,
        plan_status_before_deactivation: null,
      };
  const { error } = await admin.from("workspaces").update(patch).eq("id", workspaceId);
  if (error) return { error: error.message };

  await recordPlatformAudit({
    action: mode === "deactivate" ? "workspace.plan_deactivate" : "workspace.plan_reactivate",
    entityType: "workspace",
    entityId: workspaceId,
    before: {
      planStatus: workspace.plan_status,
      deactivatedAt: workspace.plan_deactivated_at,
      reason: workspace.plan_deactivation_reason,
    },
    after: { planStatus: patch.plan_status, reason: mode === "deactivate" ? reason : null },
  });
  revalidatePath("/app/platform/accounts");
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  revalidatePath("/app/billing");
  return { ok: true as const };
}

export async function saveWorkspaceOverrideAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const workspaceId = String(formData.get("workspaceId") || "");
  const quotas: Record<string, number> = {};
  for (const key of QUOTA_KEYS) {
    const raw = String(formData.get(key) || "").trim();
    if (raw) quotas[key] = Number(raw);
  }
  const features: Record<string, boolean> = {};
  for (const key of ["byok_ai", "lead_scrape", "export_docx", "custom_branding", "contracts"]) {
    if (String(formData.get(`feature_${key}`) || "") === "on") features[key] = true;
    if (String(formData.get(`feature_${key}_off`) || "") === "on") features[key] = false;
  }
  const { error } = await supabase.from("workspace_overrides").upsert({
    workspace_id: workspaceId,
    quotas,
    features,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "workspace.override", entityType: "workspace", entityId: workspaceId, after: { quotas, features } });
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  return { ok: true as const };
}

export async function archiveWorkspaceAction(formData: FormData) {
  await requirePlatform("super_admin");
  if (!hasServiceRole()) return { error: "Missing service role" };
  const workspaceId = String(formData.get("workspaceId") || "");
  const restore = String(formData.get("restore") || "") === "true";
  const admin = createAdminClient();
  const { data: members } = await admin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  const ids = (members || []).map((row) => row.user_id);
  if (restore) {
    await admin.from("workspaces").update({ archived_at: null }).eq("id", workspaceId);
    if (ids.length) {
      const { data: profiles } = await admin.from("profiles").select("id").in("id", ids).eq("suspend_source", "archive");
      for (const profile of profiles || []) {
        await admin.from("profiles").update({ status: "active", suspend_source: null }).eq("id", profile.id);
        await setLoginBan(profile.id, false);
      }
    }
    await recordPlatformAudit({ action: "workspace.unarchive", entityType: "workspace", entityId: workspaceId });
  } else {
    await admin.from("workspaces").update({ archived_at: new Date().toISOString() }).eq("id", workspaceId);
    if (ids.length) {
      const { data: profiles } = await admin.from("profiles").select("id, status").in("id", ids);
      for (const profile of profiles || []) {
        if (profile.status !== "active") continue;
        await admin.from("profiles").update({ status: "suspended", suspend_source: "archive" }).eq("id", profile.id);
        await setLoginBan(profile.id, true);
      }
    }
    await recordPlatformAudit({ action: "workspace.archive", entityType: "workspace", entityId: workspaceId });
  }
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  revalidatePath("/app/platform/workspaces");
  return { ok: true as const };
}

async function removeStoragePrefix(bucket: string, workspaceId: string) {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).list(workspaceId, { limit: 1000 });
  const paths = (data || []).map((item) => `${workspaceId}/${item.name}`).filter((path) => !path.endsWith("/"));
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

export async function purgeWorkspaceAction(formData: FormData) {
  await requirePlatform("super_admin");
  if (!hasServiceRole()) return { error: "Missing service role" };
  const workspaceId = String(formData.get("workspaceId") || "");
  const confirm = String(formData.get("confirm") || "").trim();
  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspaces").select("id, name, archived_at").eq("id", workspaceId).maybeSingle();
  if (!workspace) return { error: "Workspace not found." };
  if (!workspace.archived_at) return { error: "Archive the workspace before purging it." };
  if (confirm !== workspace.name) return { error: "Type the workspace name to confirm." };

  const { data: invoices } = await admin.from("invoices").select("*").eq("workspace_id", workspaceId);
  const invoiceIds = (invoices || []).map((row) => row.id);
  const { data: payments } = invoiceIds.length
    ? await admin.from("payments").select("*").in("invoice_id", invoiceIds)
    : { data: [] };
  if (invoices?.length) {
    const { error } = await admin.from("invoice_archive").insert(
      invoices.map((invoice) => ({
        source_invoice_id: invoice.id,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        plan_id: invoice.plan_id,
        payment_code: invoice.payment_code,
        amount: invoice.amount,
        currency: invoice.currency,
        billing_interval: invoice.billing_interval,
        status: invoice.status,
        vat_requested: invoice.vat_requested,
        vat_tax_code: invoice.vat_tax_code,
        paid_at: invoice.paid_at,
        payments: (payments || []).filter((payment) => payment.invoice_id === invoice.id),
        invoice_created_at: invoice.created_at,
      })),
    );
    if (error) return { error: error.message };
  }

  await removeStoragePrefix("logos", workspaceId);
  await removeStoragePrefix("presentations", workspaceId);
  await removeStoragePrefix("contracts", workspaceId);
  await recordPlatformAudit({ action: "workspace.purge", entityType: "workspace", entityId: workspaceId, before: { name: workspace.name } });
  const { error } = await admin.from("workspaces").delete().eq("id", workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/platform/workspaces");
  redirect("/app/platform/workspaces");
}

export async function markInvoicePaidAction(formData: FormData) {
  await requirePlatform("super_admin");
  const invoiceId = String(formData.get("id") || "");
  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.status !== "pending") return { error: "Invoice is not pending." };
  const result = await applySepayPayment(
    {
      id: `manual-${invoice.id}`,
      transferType: "in",
      transferAmount: invoice.amount,
      code: invoice.payment_code,
      content: invoice.payment_code,
    },
    "vietqr",
  );
  if ("error" in result && result.error) return { error: result.error };
  await recordPlatformAudit({ action: "invoice.mark_paid", entityType: "invoice", entityId: invoiceId, after: { payment_code: invoice.payment_code } });
  revalidatePath("/app/platform/payments");
  return { ok: true as const };
}

export async function cancelInvoiceAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const invoiceId = String(formData.get("id") || "");
  const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoiceId).eq("status", "pending");
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "invoice.cancel", entityType: "invoice", entityId: invoiceId });
  revalidatePath("/app/platform/payments");
  return { ok: true as const };
}

export async function revokeShareAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const workspaceId = String(formData.get("workspaceId") || "");
  const { error } = await supabase.from("public_quotes").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "share.revoke", entityType: "public_quote", entityId: null, after: { id, workspaceId } });
  revalidatePath(`/app/platform/workspaces/${workspaceId}`);
  return { ok: true as const };
}

export async function loadPlatformHealth() {
  await requirePlatform();
  const supabase = await createClient();
  const [{ data: flags }, { data: beats }] = await Promise.all([
    supabase.from("platform_flags").select("*").eq("id", 1).maybeSingle(),
    supabase.from("integration_heartbeats").select("kind, ok, detail, ran_at").order("ran_at", { ascending: false }).limit(40),
  ]);
  const latest = new Map<string, { kind: string; ok: boolean; detail: string; ran_at: string }>();
  for (const beat of beats || []) {
    if (!latest.has(beat.kind)) latest.set(beat.kind, beat);
  }
  return {
    flags: flags || { signup_enabled: true, ai_enabled: true, scrape_enabled: true, share_enabled: true },
    heartbeats: ["billing_cron", "sepay_webhook", "apify_webhook"].map((kind) => latest.get(kind) || null),
    config: {
      cron: Boolean(process.env.CRON_SECRET),
      sepayWebhook: Boolean(process.env.SEPAY_WEBHOOK_SECRET),
      apifyOauth: Boolean(process.env.APIFY_OAUTH_CLIENT_ID && process.env.APIFY_OAUTH_CLIENT_SECRET && process.env.APIFY_OAUTH_AUTHORIZATION_URL && process.env.APIFY_OAUTH_TOKEN_URL),
      platformAi: Boolean(process.env.NINE_ROUTER_API_KEY && process.env.NINE_ROUTER_BASE_URL && process.env.NINE_ROUTER_MODEL),
    },
  };
}

export async function updatePlatformFlagsAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const supabase = await createClient();
  const next = {
    signup_enabled: String(formData.get("signup_enabled") || "") === "on",
    ai_enabled: String(formData.get("ai_enabled") || "") === "on",
    scrape_enabled: String(formData.get("scrape_enabled") || "") === "on",
    share_enabled: String(formData.get("share_enabled") || "") === "on",
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("platform_flags").update(next).eq("id", 1);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "flags.update", entityType: "platform_flags", after: next });
  revalidatePath("/app/platform/health");
  return { ok: true as const };
}

export async function runBillingNowAction() {
  await requirePlatform("super_admin");
  const result = await runBillingCron();
  revalidatePath("/app/platform/health");
  if ("error" in result && result.error) return { error: result.error };
  return { ok: true as const };
}

export async function loadPlatformAudit() {
  await requirePlatform();
  const supabase = await createClient();
  const { data } = await supabase.from("platform_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
  const ids = [...new Set((data || []).map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string }[] };
  const emails = new Map((profiles || []).map((row) => [row.id, row.email]));
  return (data || []).map((row) => ({ ...row, actorEmail: row.actor_user_id ? emails.get(row.actor_user_id) || "" : "" }));
}

export async function loadWorkspaceExport(workspaceId: string) {
  await requirePlatform("super_admin");
  const admin = createAdminClient();
  const [{ data: companies }, { data: contacts }, { data: deals }, { data: quotes }] = await Promise.all([
    admin.from("companies").select("*").eq("workspace_id", workspaceId),
    admin.from("contacts").select("*").eq("workspace_id", workspaceId),
    admin.from("deals").select("*").eq("workspace_id", workspaceId),
    admin.from("quotes").select("*").eq("workspace_id", workspaceId),
  ]);
  return { companies: companies || [], contacts: contacts || [], deals: deals || [], quotes: quotes || [] };
}
