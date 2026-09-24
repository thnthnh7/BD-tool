import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireUser();
  if (context.kind === "onboarding") redirect("/onboarding");
  return <AppShell context={context}>{children}</AppShell>;
}
