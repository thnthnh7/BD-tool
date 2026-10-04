"use client";

import { useMemo, useState } from "react";
import { Alert, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { saveAiProviderAction } from "@/features/ai/server/providers";

const PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", modelPlaceholder: "gpt-4.1-mini", help: "Use an API key created in the OpenAI platform." },
  anthropic: { label: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", modelPlaceholder: "Claude model ID", help: "Use an API key and exact Claude model ID from the Anthropic Console." },
  google: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelPlaceholder: "Gemini model ID", help: "Use an API key from Google AI Studio. Bizcraw connects through Google's OpenAI-compatible endpoint." },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", modelPlaceholder: "deepseek-flash", help: "Use an API key from the DeepSeek platform and an active model ID." },
  mistral: { label: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", modelPlaceholder: "mistral-large-latest", help: "Use an API key and active model ID from La Plateforme." },
  xai: { label: "xAI Grok", baseUrl: "https://api.x.ai/v1", modelPlaceholder: "Grok model ID", help: "Use an API key and exact model ID from the xAI Console." },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modelPlaceholder: "Provider model ID", help: "Use the exact model ID shown in your OpenRouter account." },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", modelPlaceholder: "Provider model ID", help: "Use an active model ID from the Groq console." },
  custom: {
    label: "Custom LLM",
    baseUrl: "",
    modelPlaceholder: "e.g. provider/model-name",
    help: "Connect any LLM provider that supports the OpenAI-compatible Chat Completions format. Enter its Base URL, exact model ID and API key below.",
  },
} as const;

type ProviderName = keyof typeof PROVIDERS;

export function AiProviderForm({ current, submitLabel, labels }: {
  current?: { provider: string; base_url: string; model: string } | null;
  submitLabel: string;
  labels: { provider: string; model: string; apiKeyPlaceholder: string };
}) {
  const currentProvider = current?.provider;
  const initialProvider = currentProvider && currentProvider in PROVIDERS ? (currentProvider as ProviderName) : "openai";
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
