import { Center } from "@mantine/core";
import { AuthForm } from "@/components/auth-form";

export default function ForgotPage() {
  return (
    <Center mih="100vh" bg="var(--ld-canvas)" p="md">
      <AuthForm mode="forgot" />
    </Center>
  );
}
