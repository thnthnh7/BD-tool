import { Center } from "@mantine/core";
import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string; kind?: string; plan?: string }> }) {
  const { invite, kind, plan } = await searchParams;
  const next = plan ? `/onboarding?plan=${encodeURIComponent(plan)}` : undefined;
  return (
    <Center mih="100vh" bg="var(--ld-canvas)" p="md">
      <AuthForm mode="signup" invite={invite} inviteKind={kind === "platform" ? "platform" : "workspace"} next={next} />
    </Center>
  );
}
