"use client";

import { useMemo, useState } from "react";
import { Alert, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { saveAiProviderAction } from "@/features/ai/server/providers";

const PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", modelPlaceholder: "gpt-4.1-mini", help: "Use an API key created in the OpenAI platform." },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modelPlaceholder: "Provider model ID", help: "Use the exact model ID shown in your OpenRouter account." },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", modelPlaceholder: "Provider model ID", help: "Use an active model ID from the Groq console." },
  custom: { label: "OpenAI-compatible", baseUrl: "", modelPlaceholder: "Provider model name", help: "The endpoint must support the OpenAI-compatible /chat/completions API over HTTPS." },
} as const;

type ProviderName = keyof typeof PROVIDERS;

export function AiProviderForm({ current, submitLabel, labels }: {
  current?: { provider: string; base_url: string; model: string } | null;
  submitLabel: string;
  labels: { provider: string; model: string; apiKeyPlaceholder: string };
}) {
  const currentProvider = current?.provider;
  const initialProvider = currentProvider && currentProvider in PROVIDERS ? (currentProvider as ProviderName) : "custom";
  const [provider, setProvider] = useState<ProviderName>(initialProvider);
  const [baseUrl, setBaseUrl] = useState(current?.base_url || PROVIDERS[initialProvider].baseUrl);
  const preset = useMemo(() => PROVIDERS[provider], [provider]);

  return (
    <ActionForm action={saveAiProviderAction} submitLabel={submitLabel}>
      <NativeSelect
        name="provider"
        label={labels.provider}
        value={provider}
        data={Object.entries(PROVIDERS).map(([value, item]) => ({ value, label: item.label }))}
        onChange={(event) => {
          const next = event.currentTarget.value as ProviderName;
          setProvider(next);
          setBaseUrl(PROVIDERS[next].baseUrl);
        }}
      />
      <Alert color="blue" variant="light"><Text size="sm">{preset.help}</Text></Alert>
      <Stack gap="sm">
        <TextInput name="base_url" label="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} placeholder="https://provider.example/v1" required />
        <TextInput name="model" label={labels.model} placeholder={preset.modelPlaceholder} autoComplete="off" defaultValue={current?.model || ""} required />
        <TextInput name="api_key" type="password" label="API key" placeholder={labels.apiKeyPlaceholder} autoComplete="new-password" required />
      </Stack>
    </ActionForm>
  );
}
