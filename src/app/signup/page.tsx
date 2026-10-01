import { Center } from "@mantine/core";
import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string; kind?: string }> }) {
  const { invite, kind } = await searchParams;
  return (
    <Center mih="100vh" bg="var(--ld-canvas)" p="md">
      <AuthForm mode="signup" invite={invite} inviteKind={kind === "platform" ? "platform" : "workspace"} />
    </Center>
  );
}
