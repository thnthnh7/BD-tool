"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isReleasedLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function savePersonalLocaleAction(formData: FormData) {
  const context = await requireWorkspace();
  const locale = formData.get("locale");
  if (!isReleasedLocale(locale)) return { error: "Locale is not available yet." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", context.userId);
  if (error) return { error: error.message };
  (await cookies()).set("leadely-locale", locale, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/app", "layout");
  return { success: true };
}
