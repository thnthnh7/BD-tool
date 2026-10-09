import { randomBytes, randomUUID } from "node:crypto";

export async function createMcpTestWorkspace(admin, { withOwner = false } = {}) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const { data: plan, error: planError } = await admin.from("plans").select("id").eq("is_public", true).order("price_monthly", { ascending: true }).limit(1).single();
  if (planError) throw planError;
  const { data: workspace, error: workspaceError } = await admin.from("workspaces").insert({
    name: `MCP test ${suffix}`,
    slug: `mcp-test-${suffix}`,
    type: "company",
    plan_id: plan.id,
    plan_status: "trialing",
  }).select("id").single();
  if (workspaceError) throw workspaceError;
  const { error: overrideError } = await admin.from("workspace_overrides").upsert({ workspace_id: workspace.id, features: { mcp_access: true, companies: true } }, { onConflict: "workspace_id" });
  if (overrideError) throw overrideError;

  let owner = null;
  if (withOwner) {
    const email = `mcp-test-${suffix}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { full_name: "MCP Test Owner" } });
    if (error || !data.user) throw error || new Error("Could not create the MCP test owner.");
    owner = data.user;
    const { error: memberError } = await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: owner.id, role: "owner" });
    if (memberError) throw memberError;
  }

  return {
    workspace,
    owner,
    async cleanup() {
      await admin.from("workspaces").delete().eq("id", workspace.id);
      if (owner) await admin.auth.admin.deleteUser(owner.id);
    },
  };
}
