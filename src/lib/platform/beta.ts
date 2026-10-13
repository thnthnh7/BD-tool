"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requirePlatform } from "@/lib/auth/session";
import { recordPlatformAudit } from "@/lib/platform/audit";

export type PublicBetaOffer = {
  headline: string;
  description: string;
  maxParticipants: number;
  remaining: number;
  accessMonths: number;
  termsUrl: string;
};

export async function loadPublicBetaOffer(): Promise<PublicBetaOffer | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("beta_campaigns")
    .select("headline, description, max_participants, claimed_count, access_months, terms_url")
    .eq("status", "active")
    .lte("starts_at", now)
    .or(`enrollment_ends_at.is.null,enrollment_ends_at.gt.${now}`)
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  if (!data || data.claimed_count >= data.max_participants) return null;
  return {
    headline: data.headline,
    description: data.description,
    maxParticipants: data.max_participants,
    remaining: Math.max(0, data.max_participants - data.claimed_count),
    accessMonths: data.access_months,
    termsUrl: data.terms_url,
  };
}

export async function loadBetaProgram() {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const [{ data: campaign }, { data: enrollments }] = await Promise.all([
    supabase.from("beta_campaigns").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("beta_campaign_enrollments").select("*").order("position", { ascending: true }),
  ]);
  const rows = enrollments || [];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, email, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    workspaceIds.length ? supabase.from("workspaces").select("id, name, plan_id").in("id", workspaceIds) : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles || []).map((row) => [row.id, row]));
  const workspaceById = new Map((workspaces || []).map((row) => [row.id, row]));
  return {
    campaign,
    enrollments: rows.map((row) => ({
      ...row,
      email: profileById.get(row.user_id)?.email || "",
      displayName: profileById.get(row.user_id)?.display_name || "",
      workspaceName: workspaceById.get(row.workspace_id)?.name || "",
    })),
  };
}

function optionalIso(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function updateBetaCampaignAction(formData: FormData) {
  const context = await requirePlatform("super_admin");
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const maxParticipants = Math.max(1, Number(formData.get("max_participants") || 200));
  const accessMonths = Math.max(1, Math.min(24, Number(formData.get("access_months") || 2)));
  const startsAt = optionalIso(formData.get("starts_at"));
  const enrollmentEndsAt = optionalIso(formData.get("enrollment_ends_at"));
  if (startsAt === undefined || enrollmentEndsAt === undefined) return { error: "Invalid campaign date." };
  const { data: current } = await supabase.from("beta_campaigns").select("*").eq("id", id).maybeSingle();
  if (!current) return { error: "Beta campaign not found." };
  if (maxParticipants < current.claimed_count) return { error: `Capacity cannot be lower than ${current.claimed_count} issued places.` };
  if (startsAt && enrollmentEndsAt && enrollmentEndsAt <= startsAt) return { error: "Enrollment end must be after the start date." };
  const status = String(formData.get("status") || "draft");
  if (!["draft", "active", "paused", "ended"].includes(status)) return { error: "Invalid campaign status." };
  const patch = {
    name: String(formData.get("name") || "").trim() || "Founding Beta 200",
    status,
    max_participants: maxParticipants,
    access_months: accessMonths,
    starts_at: startsAt || new Date().toISOString(),
    enrollment_ends_at: enrollmentEndsAt,
    new_accounts_only: formData.get("new_accounts_only") === "on",
    require_verified_email: formData.get("require_verified_email") === "on",
    headline: String(formData.get("headline") || "").trim() || "Beta Early Access",
    description: String(formData.get("description") || "").trim(),
    terms_url: String(formData.get("terms_url") || "").trim() || "/terms",
    updated_by: context.userId,
  };
  const { error } = await supabase.from("beta_campaigns").update(patch).eq("id", id);
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: "beta_campaign_updated", entityType: "beta_campaign", entityId: id, before: current, after: patch });
  revalidatePath("/app/platform/beta");
  revalidatePath("/signup");
  revalidatePath("/onboarding");
  return { ok: true as const };
}

export async function updateBetaCampaignFormAction(formData: FormData): Promise<void> {
  const result = await updateBetaCampaignAction(formData);
  if (result && "error" in result && result.error) throw new Error(result.error);
}

export async function manageBetaEnrollmentAction(formData: FormData) {
  await requirePlatform("super_admin");
  const supabase = await createClient();
  const enrollmentId = String(formData.get("enrollment_id") || "");
  const action = String(formData.get("mode") || "");
  const months = Math.max(1, Math.min(24, Number(formData.get("months") || 1)));
  const reason = String(formData.get("reason") || "").trim();
  const { error } = await supabase.rpc("manage_beta_enrollment", {
    p_enrollment_id: enrollmentId,
    p_action: action,
    p_months: months,
    p_reason: reason || undefined,
  });
  if (error) return { error: error.message };
  await recordPlatformAudit({ action: `beta_enrollment_${action}`, entityType: "beta_enrollment", entityId: enrollmentId, after: { months, reason } });
  revalidatePath("/app/platform/beta");
  return { ok: true as const };
}

export async function manageBetaEnrollmentFormAction(formData: FormData): Promise<void> {
  const result = await manageBetaEnrollmentAction(formData);
  if (result && "error" in result && result.error) throw new Error(result.error);
}
