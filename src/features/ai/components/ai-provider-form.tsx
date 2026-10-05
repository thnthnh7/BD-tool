"use client";

import { useMemo, useRef, useState } from "react";
import { Alert, Button, Checkbox, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { AI_PROVIDERS, type AiProviderName } from "@/features/ai/provider-catalog";
import { listAiModelsAction, saveAiProviderAction } from "@/features/ai/server/providers";

export function AiProviderForm({ current, submitLabel, labels }: {
  current?: { provider: string; base_url: string; model: string } | null;
  submitLabel: string;
  labels: { provider: string; model: string; apiKeyPlaceholder: string };
}) {
  const currentProvider = current?.provider;
  const initialProvider = currentProvider && currentProvider in AI_PROVIDERS ? (currentProvider as AiProviderName) : "openai";
  const [provider, setProvider] = useState<AiProviderName>(initialProvider);
  const [baseUrl, setBaseUrl] = useState(current?.base_url || AI_PROVIDERS[initialProvider].baseUrl);
  const [showBase, setShowBase] = useState(initialProvider === "custom");
  const [models, setModels] = useState<string[]>(current?.model ? [current.model] : []);
  const [model, setModel] = useState(current?.model || "");
  const [source, setSource] = useState<"account" | "fallback" | "">("");
  const [customModel, setCustomModel] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const loadedKey = useRef("");
  const loadTimer = useRef<number | null>(null);
  const preset = useMemo(() => AI_PROVIDERS[provider], [provider]);

  async function loadModels(apiKey: string) {
    const key = apiKey.trim();
    if (key.length < 12 || !baseUrl) return;
    const mark = `${provider}|${baseUrl}|${key}`;
    if (loadedKey.current === mark) return;
    setLoading(true);
    setNotice("");
    const result = await listAiModelsAction({ provider, baseUrl, apiKey: key });
    setLoading(false);
    if ("error" in result) {
      setNotice(result.error || "Could not load models.");
      return;
    }
    loadedKey.current = mark;
    setModels(result.models);
    setSource(result.source);
    setModel(result.model ?? "");
    setCustomModel(false);
  }

  return (
    <ActionForm action={saveAiProviderAction} submitLabel={submitLabel}>
      <NativeSelect
        name="provider"
        label={labels.provider}
        value={provider}
        data={Object.entries(AI_PROVIDERS).map(([value, item]) => ({ value, label: item.label }))}
        onChange={(event) => {
          const next = event.currentTarget.value as AiProviderName;
          setProvider(next);
          setBaseUrl(AI_PROVIDERS[next].baseUrl);
          setShowBase(next === "custom");
          setModels([]);
          setModel("");
          setSource("");
          setNotice("");
          loadedKey.current = "";
        }}
      />
      <Alert color="blue" variant="light"><Text size="sm">{preset.help}</Text></Alert>
      <Stack gap="sm">
        {showBase ? (
          <TextInput name="base_url" label="Base URL" value={baseUrl} onChange={(event) => { setBaseUrl(event.currentTarget.value); loadedKey.current = ""; }} placeholder="https://provider.example/v1" required />
        ) : (
          <input type="hidden" name="base_url" value={baseUrl} />
        )}
        {provider !== "custom" && !showBase ? (
          <Button type="button" variant="subtle" size="compact-sm" w="fit-content" onClick={() => setShowBase(true)}>Edit base URL</Button>
        ) : null}
        <TextInput
          name="api_key"
          type="password"
          label="API key"
          placeholder={labels.apiKeyPlaceholder}
          autoComplete="new-password"
          required
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (loadTimer.current) window.clearTimeout(loadTimer.current);
            loadTimer.current = window.setTimeout(() => void loadModels(value), 400);
          }}
          onBlur={(event) => void loadModels(event.currentTarget.value)}
        />
        {loading ? <Text size="sm" c="dimmed">Loading the models this key can use…</Text> : null}
        {notice ? <Text size="sm" c="red">{notice}</Text> : null}
        {source === "account" ? <Text size="sm" c="dimmed">These are the models this API key can use.</Text> : null}
        {source === "fallback" ? <Text size="sm" c="dimmed">This provider did not list models for the key. Pick a common model, or type an ID.</Text> : null}
        {models.length > 0 && !customModel ? (
          <NativeSelect name="model" label={labels.model} value={models.includes(model) ? model : models[0]} data={models} onChange={(event) => setModel(event.currentTarget.value)} />
        ) : null}
        {customModel || (models.length === 0 && Boolean(current?.model)) ? (
          <TextInput name="model" label={labels.model} value={model} onChange={(event) => setModel(event.currentTarget.value)} placeholder="Model ID" autoComplete="off" required />
        ) : null}
        {models.length === 0 && !current?.model ? <Text size="sm" c="dimmed">Paste the API key. The models it can use will show here.</Text> : null}
        {models.length > 0 ? (
          <Checkbox label="Type a model ID" checked={customModel} onChange={(event) => setCustomModel(event.currentTarget.checked)} />
        ) : null}
      </Stack>
    </ActionForm>
  );
}
