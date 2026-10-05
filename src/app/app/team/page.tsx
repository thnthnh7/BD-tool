import { requireOwnerOrAdmin, requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TeamPanel } from "@/components/team-panel";

export default async function TeamPage() {
  await requireModule("team");
  const context = await requireOwnerOrAdmin();
  if (context.workspaceType !== "company") {
    return <TeamPanel members={[]} viewerRole="owner" workspaceType="personal" seatLimit={context.plan.quotas.seats} />;
  }
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("role, user_id, seat_priority_at")
    .eq("workspace_id", context.workspaceId)
    .order("seat_priority_at", { ascending: true });
  const { count: pendingInvites } = await supabase.from("invites")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", context.workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());
  const ids = (members || []).map((row) => row.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const ordered = [...(members || [])].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return a.seat_priority_at.localeCompare(b.seat_priority_at) || a.user_id.localeCompare(b.user_id);
  });
  const view = ordered.map((row, index) => {
    const profile = profiles?.find((item) => item.id === row.user_id);
    return { userId: row.user_id, email: profile?.email || "", displayName: profile?.display_name || "", role: row.role, seatActive: context.plan.quotas.seats < 0 || index < context.plan.quotas.seats };
  });
  return (
    <TeamPanel
      members={view}
      viewerRole={context.memberRole === "owner" ? "owner" : "admin"}
      workspaceType="company"
      seatLimit={context.plan.quotas.seats}
      pendingInvites={pendingInvites || 0}
    />
  );
}
