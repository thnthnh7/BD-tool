"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";

function resolveRedirect(template: string | undefined, fallback: string | undefined, id?: string) {
  if (!template) return fallback;
  if (template.includes("{id}")) {
    return id ? template.replaceAll("{id}", id) : fallback;
  }
  return template;
}

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  redirectTo,
  redirectFallback,
  layout = "stack",
  onSuccess,
  variant = "filled",
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean; id?: string }>;
  children: ReactNode;
  submitLabel?: string;
  redirectTo?: string;
  redirectFallback?: string;
  /** Place fields and the submit button on one row. */
  layout?: "stack" | "inline";
  onSuccess?: () => void;
  variant?: "filled" | "light";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const button = (
    <Button type="submit" loading={pending} w="fit-content" variant={variant}>
      {submitLabel}
    </Button>
  );
  const errorNode = error ? (
    <Text size="sm" c="red">
      {error}
    </Text>
  ) : null;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setPending(true);
        setError("");
        const result = await action(new FormData(form));
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        form.reset();
        onSuccess?.();
        const href = resolveRedirect(redirectTo, redirectFallback, result.id);
        if (href) router.push(href);
        else router.refresh();
      }}
    >
      {layout === "inline" ? (
        <Stack gap="xs">
          <Group align="flex-end" gap="sm" wrap="wrap">
            {children}
            {button}
          </Group>
          {errorNode}
        </Stack>
      ) : (
        <Stack gap="sm">
          {children}
          {errorNode}
          {button}
        </Stack>
      )}
    </form>
  );
}
