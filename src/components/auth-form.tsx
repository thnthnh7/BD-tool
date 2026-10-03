"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Divider, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { LinkAnchor } from "@/components/mantine-link";
import { signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword } from "@/lib/auth/actions";
import classes from "@/styles/leadely-surfaces.module.css";

export function AuthForm({
  mode,
  invite,
  inviteKind,
  next,
}: {
  mode: "login" | "signup" | "forgot";
  invite?: string;
  inviteKind?: "workspace" | "platform";
  next?: string;
}) {
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "false";
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googlePending, startGoogleTransition] = useTransition();

  function continueWithGoogle() {
    setError("");
    setMessage("");
    startGoogleTransition(async () => {
      const result = await signInWithGoogle(invite, inviteKind, next);
      if (result?.error) setError(result.error);
    });
  }

  async function onSubmit(formData: FormData) {
    setError("");
    setMessage("");
    if (mode === "login") {
      const result = await signInWithPassword(formData);
      if (result?.error) setError(result.error);
      return;
    }
    if (mode === "signup") {
      if (invite) formData.set("invite", invite);
      if (inviteKind) formData.set("invite_kind", inviteKind);
      const result = await signUpWithPassword(formData);
      if (result?.error) setError(result.error);
      else if (result?.message) setMessage(result.message);
      return;
    }
    const result = await resetPassword(formData);
    if (result && "error" in result && result.error) setError(result.error);
    else setMessage("Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.");
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" w="100%" className={classes.panel}>
      <AppLogo tagline />
      <Title order={2} mt="lg">
        {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
      </Title>
      <Text size="sm" c="dimmed" mt="xs">
        One account = one role. Don’t share an email across roles.
      </Text>
      <form action={onSubmit}>
        <Stack mt="lg" gap="md">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <TextInput name="email" type="email" required placeholder="Email" />
          {mode !== "forgot" ? <PasswordInput name="password" required minLength={8} placeholder="Password" /> : null}
          {error ? <Alert color="red">{error}</Alert> : null}
          {message ? <Alert color="leadely">{message}</Alert> : null}
          <Button type="submit" fullWidth>
            {mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Send email"}
          </Button>
        </Stack>
      </form>
      {mode !== "forgot" && googleEnabled ? (
        <Stack gap="sm" mt="md">
          <Divider label="or" labelPosition="center" />
          <Button variant="default" fullWidth leftSection={<GoogleLogo />} loading={googlePending} onClick={continueWithGoogle}>
          Continue with Google
          </Button>
        </Stack>
      ) : null}
      <Group justify="space-between" mt="lg">
        {mode === "login" ? (
          <>
            <LinkAnchor href="/signup" size="sm" c="leadely" fw={600}>
              Create account
            </LinkAnchor>
            <LinkAnchor href="/forgot" size="sm" c="dimmed" fw={600}>
              Forgot password
            </LinkAnchor>
          </>
        ) : (
          <LinkAnchor href="/login" size="sm" c="leadely" fw={600}>
            {mode === "forgot" ? "Back to sign in" : "Already have an account"}
          </LinkAnchor>
        )}
      </Group>
    </Paper>
  );
}

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.715H.956v2.332A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.963 10.705A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.705V4.963H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.037l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.963l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
  </svg>;
}
