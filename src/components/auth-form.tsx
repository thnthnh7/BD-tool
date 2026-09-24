"use client";

import { useState } from "react";
import { Alert, Button, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { LinkAnchor } from "@/components/mantine-link";
import { signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword } from "@/lib/auth/actions";
import classes from "@/styles/leadely-surfaces.module.css";

export function AuthForm({
  mode,
  invite,
}: {
  mode: "login" | "signup" | "forgot";
  invite?: string;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      const result = await signUpWithPassword(formData);
      if (result?.error) setError(result.error);
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
          <TextInput name="email" type="email" required placeholder="Email" />
          {mode !== "forgot" ? <PasswordInput name="password" required minLength={8} placeholder="Password" /> : null}
          {error ? <Alert color="red">{error}</Alert> : null}
          {message ? <Alert color="leadely">{message}</Alert> : null}
          <Button type="submit" fullWidth>
            {mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Send email"}
          </Button>
        </Stack>
      </form>
      {mode !== "forgot" ? (
        <Button variant="default" fullWidth mt="sm" onClick={() => signInWithGoogle(invite)}>
          Continue with Google
        </Button>
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
