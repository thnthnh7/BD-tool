export const AI_PROVIDERS = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    help: "Paste an API key from the OpenAI platform. That page lists keys only. Bizcraw loads the models this key can use.",
    preferred: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "gpt-5-mini", "gpt-5"],
  },
  anthropic: {
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    help: "Paste an API key from the Anthropic Console. Bizcraw loads the Claude models this key can use.",
    preferred: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
  },
  google: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    help: "Paste an API key from Google AI Studio. Bizcraw loads the Gemini models this key can use.",
    preferred: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    help: "Paste an API key from DeepSeek. Bizcraw loads the models this key can use.",
    preferred: ["deepseek-chat", "deepseek-reasoner"],
  },
  mistral: {
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    help: "Paste an API key from La Plateforme. Bizcraw loads the models this key can use.",
    preferred: ["mistral-small-latest", "mistral-large-latest"],
  },
  xai: {
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    help: "Paste an API key from the xAI Console. Bizcraw loads the models this key can use.",
    preferred: ["grok-3-mini", "grok-3"],
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    help: "Paste an OpenRouter API key. Bizcraw loads the models this key can use.",
    preferred: ["openai/gpt-4.1-mini", "openai/gpt-4o-mini"],
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    help: "Paste an API key from the Groq console. Bizcraw loads the models this key can use.",
    preferred: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  custom: {
    label: "Custom LLM",
    baseUrl: "",
    help: "Use a provider with an OpenAI-compatible API. Enter its base URL and API key, then load the models that key can use.",
    preferred: [] as string[],
  },
} as const;

export type AiProviderName = keyof typeof AI_PROVIDERS;

const BLOCKED_MODEL = /(embed|whisper|tts|dall-e|moderation|realtime|transcri|image|audio|sora|search|davinci|babbage|^ft:)/i;

export function filterChatModelIds(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.replace(/^models\//, "").trim()).filter(Boolean))];
  const chat = unique.filter((id) => !BLOCKED_MODEL.test(id));
  return (chat.length ? chat : unique).slice(0, 50);
}

export function orderModels(provider: string, ids: string[]) {
  const preferred = provider in AI_PROVIDERS ? AI_PROVIDERS[provider as AiProviderName].preferred : [];
  const rank = (id: string) => {
    const index = preferred.findIndex((item) => id === item || id.startsWith(`${item}-`));
    return index === -1 ? preferred.length + 1 : index;
  };
  return [...ids].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right));
}

export function pickDefaultModel(provider: string, ids: string[], current?: string) {
  if (current && ids.includes(current)) return current;
  const preferred = provider in AI_PROVIDERS ? AI_PROVIDERS[provider as AiProviderName].preferred : [];
  for (const item of preferred) {
    const match = ids.find((id) => id === item || id.startsWith(`${item}-`));
    if (match) return match;
  }
  return ids[0] || preferred[0] || "";
}

export function fallbackModels(provider: string) {
  return provider in AI_PROVIDERS ? [...AI_PROVIDERS[provider as AiProviderName].preferred] : [];
}

export function explainProviderError(raw: string) {
  const text = raw.trim();
  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === "string") message = parsed.error;
    else if (parsed.error && typeof parsed.error.message === "string") message = parsed.error.message;
    else if (typeof parsed.message === "string") message = parsed.message;
  } catch {
    message = text;
  }
  if (/does not exist|model_not_found|not_found_error|invalid model/i.test(message)) {
    return "This API key cannot use that model. Choose a model from the list for this key.";
  }
  if (/api key|authentication|unauthorized|invalid_api_key/i.test(message)) {
    return "The API key was rejected. Check the key in the provider account and paste it again.";
  }
  const clean = message.replace(/\s+/g, " ").slice(0, 180);
  return clean ? `Could not connect to the provider. ${clean}` : "Could not connect to the provider.";
}
