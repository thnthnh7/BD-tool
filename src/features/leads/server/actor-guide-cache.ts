import "server-only";

import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTOR_GUIDE_PROMPT_VERSION, structuredActorGuide, type StructuredActorGuide } from "@/features/leads/actor-guide";

const GUIDE_PROVIDER = "deterministic";
const GUIDE_MODEL = "schema-readme-v1";

export async function getOrCreateActorGuide(input: {
  sourceId: string;
  contractHash: string;
  locale: string;
  schema: Json | null;
  example: Json | null;
  readmeMarkdown: string;
}): Promise<{ guide: StructuredActorGuide; cached: boolean; promptVersion: string; provider: string; model: string }> {
  const admin = createAdminClient();
  const locale = input.locale.toLowerCase().startsWith("vi") ? "vi" : "en";
  const identity = {
    source_id: input.sourceId,
    contract_hash: input.contractHash,
    locale,
    prompt_version: ACTOR_GUIDE_PROMPT_VERSION,
    provider: GUIDE_PROVIDER,
    model: GUIDE_MODEL,
  };
  const { data } = await admin.from("actor_generated_guides")
    .select("guide")
    .match(identity)
    .maybeSingle();
  if (data?.guide) {
    return {
      guide: data.guide as unknown as StructuredActorGuide,
      cached: true,
      promptVersion: ACTOR_GUIDE_PROMPT_VERSION,
      provider: GUIDE_PROVIDER,
      model: GUIDE_MODEL,
    };
  }
  const guide = structuredActorGuide({
    schema: input.schema,
    example: input.example,
    readmeMarkdown: input.readmeMarkdown,
    locale,
  });
  await admin.from("actor_generated_guides").upsert({
    ...identity,
    guide: guide as unknown as Json,
  }, { onConflict: "source_id,contract_hash,locale,prompt_version,provider,model", ignoreDuplicates: true });
  return {
    guide,
    cached: false,
    promptVersion: ACTOR_GUIDE_PROMPT_VERSION,
    provider: GUIDE_PROVIDER,
    model: GUIDE_MODEL,
  };
}
