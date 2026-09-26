"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeCrmProviderTokens, storeCrmTokens } from "@/features/crm-integrations/server/oauth";
import { crmProviderIds, crmSyncObjects, leadelyMappingFields } from "@/features/crm-integrations/catalog";

const directions = new Set(["import", "export", "bidirectional"]);
const conflictPolicies = new Set(["latest_update", "leadely_wins", "crm_wins"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function editableWorkspace() {
  const context = await requireWorkspace();
  if (context.memberRole === "member") return { error: "Only workspace owners and admins can manage CRM integrations." } as const;
  return { context, supabase: await createClient() } as const;
}

export async function loadCrmIntegrations() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const [{ data: connections }, { data: runs }, { data: mappings }, { data: providerConfigs }, { data: audit }] = await Promise.all([
    supabase.from("crm_connections").select("*").eq("workspace_id", context.workspaceId).order("updated_at", { ascending: false }),
    supabase.from("crm_sync_runs").select("*").eq("workspace_id", context.workspaceId).order("started_at", { ascending: false }).limit(20),
    supabase.from("crm_field_mappings").select("*").eq("workspace_id", context.workspaceId).order("object_type").order("leadely_field"),
    supabase.rpc("crm_provider_availability"),
    supabase.from("crm_connection_audit").select("*").eq("workspace_id", context.workspaceId).order("created_at", { ascending: false }).limit(30),
  ]);
  return { context, connections: connections || [], runs: runs || [], mappings: mappings || [], providerConfigs: providerConfigs || [], audit: audit || [] };
}

export async function saveCrmConnectionAction(formData: FormData) {
  const workspace = await editableWorkspace();
  if ("error" in workspace) return { error: workspace.error };
  const { context, supabase } = workspace;
  const provider = text(formData, "provider");
  const syncDirection = text(formData, "sync_direction");
  const conflictPolicy = text(formData, "conflict_policy");
  const syncInterval = Number(text(formData, "sync_interval_minutes"));
  const objects = formData.getAll("sync_objects").map(String).filter((value) => crmSyncObjects.includes(value as (typeof crmSyncObjects)[number]));
  if (!crmProviderIds.has(provider)) return { error: "Unsupported CRM provider." };
  const { data: providerConfig } = await supabase.from("crm_provider_configs").select("enabled").eq("provider", provider).maybeSingle();
  if (!providerConfig?.enabled) return { error: "This CRM connector is not available yet." };
  if (!directions.has(syncDirection)) return { error: "Invalid synchronization direction." };
  if (!conflictPolicies.has(conflictPolicy)) return { error: "Invalid conflict policy." };
  if (![5, 15, 30, 60, 360, 1440].includes(syncInterval)) return { error: "Invalid synchronization interval." };
  if (!objects.length) return { error: "Select at least one data type to synchronize." };

  const { error } = await supabase.from("crm_connections").upsert({
    workspace_id: context.workspaceId,
    provider,
    sync_direction: syncDirection,
    conflict_policy: conflictPolicy,
    sync_interval_minutes: syncInterval,
    sync_objects: objects,
    account_label: text(formData, "account_label"),
    created_by: context.userId,
  }, { onConflict: "workspace_id,provider" });
  if (error) return { error: error.message };
  revalidatePath("/app/crm-integrations");
  return { ok: true as const };
}

export async function saveCrmFieldMappingAction(formData: FormData) {
  const workspace = await editableWorkspace();
  if ("error" in workspace) return { error: workspace.error };
  const { context, supabase } = workspace;
  const connectionId = text(formData, "connection_id");
  const objectType = text(formData, "object_type") as (typeof crmSyncObjects)[number];
  const leadelyField = text(formData, "leadely_field");
  const externalField = text(formData, "external_field");
  const syncDirection = text(formData, "sync_direction");
  if (!connectionId) return { error: "Save the connection setup before adding field mappings." };
  if (!crmSyncObjects.includes(objectType)) return { error: "Invalid data type." };
  if (!leadelyMappingFields[objectType].includes(leadelyField)) return { error: "Invalid Leadely field." };
  if (!externalField) return { error: "Enter the field name used by the connected CRM." };
  if (!directions.has(syncDirection)) return { error: "Invalid mapping direction." };
  const { data: connection } = await supabase.from("crm_connections").select("id").eq("id", connectionId).eq("workspace_id", context.workspaceId).maybeSingle();
  if (!connection) return { error: "CRM connection not found." };
  const { error } = await supabase.from("crm_field_mappings").upsert({
    workspace_id: context.workspaceId,
    connection_id: connectionId,
    object_type: objectType,
    leadely_field: leadelyField,
    external_field: externalField,
    sync_direction: syncDirection,
  }, { onConflict: "connection_id,object_type,leadely_field" });
  if (error) return { error: error.message };
  await supabase.from("crm_connections").update({ setup_step: "mapping" }).eq("id", connectionId).eq("workspace_id", context.workspaceId);
  revalidatePath("/app/crm-integrations");
  return { ok: true as const };
}

export async function setCrmConnectionStateAction(formData: FormData) {
  const workspace = await editableWorkspace();
  if ("error" in workspace) return { error: workspace.error };
  const { context, supabase } = workspace;
  const id = text(formData, "id");
  const mode = text(formData, "mode");
  const status = mode === "pause" ? "paused" : mode === "resume" ? "connected" : null;
  if (!id || !status) return { error: "Invalid connection action." };
  const { error } = await supabase.from("crm_connections").update({ status }).eq("id", id).eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/crm-integrations");
  return { ok: true as const };
}

export async function disconnectCrmConnectionAction(formData: FormData) {
  const workspace = await editableWorkspace();
  if ("error" in workspace) return { error: workspace.error };
  const id = text(formData, "id");
  const { data: connection } = await workspace.supabase.from("crm_connections").select("id").eq("id", id).eq("workspace_id", workspace.context.workspaceId).maybeSingle();
  if (!connection) return { error: "CRM connection not found." };
  await revokeCrmProviderTokens(id);
  const { error } = await workspace.supabase.rpc("revoke_crm_connection", { p_connection_id: id, p_actor_user_id: workspace.context.userId });
  if (error) return { error: error.message };
  revalidatePath("/app/crm-integrations");
  return { ok: true as const };
}

export async function saveActiveCampaignCredentialsAction(formData: FormData) {
  const workspace = await editableWorkspace();
  if ("error" in workspace) return { error: workspace.error };
  const connectionId = text(formData, "connection_id");
  const apiUrl = text(formData, "api_url");
  const apiKey = text(formData, "api_key");
  try { new URL(apiUrl); } catch { return { error: "Enter a valid ActiveCampaign account URL." }; }
  if (apiKey.length < 10) return { error: "Enter a valid ActiveCampaign API key." };
  const { data: connection } = await workspace.supabase.from("crm_connections").select("id, provider").eq("id", connectionId).eq("workspace_id", workspace.context.workspaceId).maybeSingle();
  if (!connection || connection.provider !== "activecampaign") return { error: "ActiveCampaign connection not found." };
  await storeCrmTokens({ connectionId, userId: workspace.context.userId, accessToken: apiKey, metadata: { auth_method: "api_key", api_url: new URL(apiUrl).origin } });
  await createAdminClient().from("crm_connections").update({ account_label: new URL(apiUrl).origin }).eq("id", connectionId);
  revalidatePath("/app/crm-integrations");
  return { ok: true as const };
}
