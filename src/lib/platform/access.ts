import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

const BAN_DURATION = "876000h";

export async function setLoginBan(userId: string, banned: boolean) {
  if (!hasServiceRole()) return "Missing service role";
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? BAN_DURATION : "none",
  });
  return error?.message;
}
