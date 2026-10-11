"use client";

import { Alert, Badge, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveApifyTokenAction } from "@/features/leads/server/apify-actions";

type TokenSummary = {
  label: string;
  lastFour: string;
};

type ApifyTokenFormLabels = {
  currentToken: string;
  maskedTokenHelp: string;
  savedSuccess: string;
  saveFailed: string;
  tokenName: string;
  newToken: string;
  newTokenPlaceholder: string;
  submit: string;
};

export function ApifyTokenForm({
  initialLabel,
  currentLastFour,
  labels,
}: {
  initialLabel: string;
  currentLastFour?: string | null;
  labels: ApifyTokenFormLabels;
}) {
  const router = useRouter();
  const [tokenLabel, setTokenLabel] = useState(initialLabel);
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<TokenSummary | null>(currentLastFour ? { label: initialLabel, lastFour: currentLastFour } : null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccess("");
    setError("");
    try {
      const result = await saveApifyTokenAction(new FormData(event.currentTarget));
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("tokenLabel" in result) || !("tokenLastFour" in result) || !result.tokenLabel || !result.tokenLastFour) {
        setError(labels.saveFailed);
        return;
      }
      setSavedToken({ label: result.tokenLabel, lastFour: result.tokenLastFour });
      setToken("");
      setSuccess(labels.savedSuccess);
      router.refresh();
    } catch {
      setError(labels.saveFailed);
    } finally {
      setPending(false);
    }
  }

  return <Stack gap="sm">
    {savedToken ? <Stack gap={4}>
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={650}>{labels.currentToken}</Text>
        <Badge color="teal" variant="light" tt="none">{savedToken.label} · Token ••••{savedToken.lastFour}</Badge>
      </Group>
      <Text size="xs" c="dimmed">{labels.maskedTokenHelp}</Text>
    </Stack> : null}
    <form onSubmit={submit}>
      <Stack gap="sm">
        <TextInput name="token_label" label={labels.tokenName} value={tokenLabel} onChange={(event) => setTokenLabel(event.currentTarget.value)} />
        <TextInput name="api_token" type="password" label={labels.newToken} placeholder={labels.newTokenPlaceholder} autoComplete="new-password" value={token} onChange={(event) => setToken(event.currentTarget.value)} required />
        {error ? <Alert color="red" role="alert">{error}</Alert> : null}
        {success ? <Alert color="teal" role="status" aria-live="polite">{success}</Alert> : null}
        <Button type="submit" loading={pending} w="fit-content">{labels.submit}</Button>
      </Stack>
    </form>
  </Stack>;
}
