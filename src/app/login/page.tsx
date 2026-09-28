import { Center } from "@mantine/core";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  return (
    <Center mih="100vh" bg="var(--ld-canvas)" p="md">
      <AuthForm mode="login" next={next} />
    </Center>
  );
}
