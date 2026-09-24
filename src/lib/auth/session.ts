import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { applyPlanOverrides, parsePlan, type ParsedPlan, type PlanStatus } from "@/lib/entitlements";

export type MemberRole = "owner" | "admin" | "member";
export type PlatformRole = "super_admin" | "support";

export type SessionContext =
  | {
      kind: "onboarding";
      userId: string;
      email: string;
    }
  | {
      kind: "platform";
      userId: string;
      email: string;
      platformRole: PlatformRole;
    }
  | {
      kind: "workspace";
      userId: string;
      email: string;
      workspaceId: string;
      workspaceName: string;
      workspaceType: "personal" | "company";
      memberRole: MemberRole;
      plan: ParsedPlan;
      planStatus: PlanStatus;
      locked: boolean;
    };

export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const userId = data.user.id;
  const email = data.user.email || "";

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
  if (profile?.status === "suspended" || profile?.status === "deleted") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { data: platform } = await supabase
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (platform?.role === "super_admin" || platform?.role === "support") {
    return { kind: "platform", userId, email, platformRole: platform.role };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return { kind: "onboarding", userId, email };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, type, plan_id, plan_status, locked, archived_at")
    .eq("id", membership.workspace_id)
    .single();

  if (!workspace) {
    return { kind: "onboarding", userId, email };
  }

  const { data: planRow } = await supabase.from("plans").select("*").eq("id", workspace.plan_id).single();
  if (!planRow) {
    return { kind: "onboarding", userId, email };
  }

  const { data: override } = await supabase
    .from("workspace_overrides")
    .select("quotas, features")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  return {
    kind: "workspace",
    userId,
    email,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceType: workspace.type as "personal" | "company",
    memberRole: membership.role as MemberRole,
    plan: applyPlanOverrides(parsePlan(planRow), override?.quotas, override?.features),
    planStatus: workspace.plan_status as PlanStatus,
    locked: workspace.locked || Boolean(workspace.archived_at),
  };
});

export async function requireUser() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireWorkspace() {
  const context = await requireUser();
  if (context.kind === "onboarding") redirect("/onboarding");
  if (context.kind === "platform") redirect("/app/platform/plans");
  return context;
}

export async function requireOwner() {
  const context = await requireWorkspace();
  if (context.memberRole !== "owner") redirect("/app");
  return context;
}

export async function requireOwnerOrAdmin() {
  const context = await requireWorkspace();
  if (context.memberRole === "member") redirect("/app");
  return context;
}

export async function requirePlatform(role?: PlatformRole) {
  const context = await requireUser();
  if (context.kind === "onboarding") redirect("/onboarding");
  if (context.kind !== "platform") redirect("/app");
  if (role === "super_admin" && context.platformRole !== "super_admin") redirect("/app/platform/workspaces");
  return context;
}
