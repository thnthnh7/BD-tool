const DIMENSIONS = 384;

function normalize(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / magnitude);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function localEmbedding(text: string) {
  const vector = Array<number>(DIMENSIONS).fill(0);
  const normalized = text.toLocaleLowerCase().normalize("NFKC");
  const words = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const tokens = [...words, ...words.slice(0, -1).map((word, index) => `${word}_${words[index + 1]}`)];
  for (const token of tokens) {
    const hash = hashToken(token);
    vector[hash % DIMENSIONS] += (hash & 1) === 0 ? 1 : -1;
  }
  return normalize(vector);
}

export async function embedTexts(texts: string[]) {
  const baseUrl = process.env.EMBEDDING_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  if (baseUrl && apiKey && model) {
    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: texts, dimensions: DIMENSIONS }),
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
        const rows = [...(payload.data || [])].sort((a, b) => (a.index || 0) - (b.index || 0));
        if (rows.length === texts.length && rows.every((row) => row.embedding?.length === DIMENSIONS)) {
          return rows.map((row) => normalize(row.embedding || []));
        }
      }
    } catch (error) {
      console.warn("knowledge.embedding remote failed", error);
    }
  }
  return texts.map(localEmbedding);
}

export function vectorLiteral(values: number[]) {
  return `[${values.map((value) => value.toFixed(8)).join(",")}]`;
}
