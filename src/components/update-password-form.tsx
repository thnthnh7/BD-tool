"use client";

import { useState } from "react";
import { Alert, Button, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { LinkAnchor } from "@/components/mantine-link";
import { updatePassword } from "@/lib/auth/actions";
import classes from "@/styles/leadely-surfaces.module.css";

export function UpdatePasswordForm() {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function onSubmit(formData: FormData) {
    setError("");
    const result = await updatePassword(formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" w="100%" className={classes.panel}>
      <AppLogo tagline />
      <Title order={2} mt="lg">Set a new password</Title>
      <Text size="sm" c="dimmed" mt="xs">Choose a new password for your Bizcraw account.</Text>
      {saved ? (
        <Stack mt="lg">
          <Alert color="leadely">Your password has been updated. Sign in again to continue.</Alert>
          <Button component={LinkAnchor} href="/login" fullWidth>Sign in</Button>
        </Stack>
      ) : (
        <form action={onSubmit}>
          <Stack mt="lg" gap="md">
            <PasswordInput name="password" required minLength={8} label="New password" autoComplete="new-password" />
            <PasswordInput name="password_confirmation" required minLength={8} label="Confirm new password" autoComplete="new-password" />
            {error ? <Alert color="red">{error}</Alert> : null}
            <Button type="submit" fullWidth>Update password</Button>
          </Stack>
        </form>
      )}
    </Paper>
  );
}
