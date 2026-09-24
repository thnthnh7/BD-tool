import { redirect } from "next/navigation";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TeamPanel } from "@/components/team-panel";

export default async function TeamPage() {
  const context = await requireOwnerOrAdmin();
  if (context.workspaceType !== "company") redirect("/app/settings");
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("role, user_id")
    .eq("workspace_id", context.workspaceId);
  const ids = (members || []).map((row) => row.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const view = (members || []).map((row) => {
    const profile = profiles?.find((item) => item.id === row.user_id);
    return { userId: row.user_id, email: profile?.email || "", displayName: profile?.display_name || "", role: row.role };
  });
  return <TeamPanel members={view} viewerRole={context.memberRole === "owner" ? "owner" : "admin"} />;
}
