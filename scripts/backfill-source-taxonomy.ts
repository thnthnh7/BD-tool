import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { classifyActorSource } from "@/features/leads/source-taxonomy";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase environment is missing.");

const admin = createClient(url, key, { auth: { persistSession: false } });
const pageSize = 500;

async function main() {
  let processed = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin.from("scrape_sources")
      .select("id,slug,title,description,categories")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    const rows = data.map((source) => {
      const taxonomy = classifyActorSource(source);
      return {
        id: source.id,
        use_cases: taxonomy.useCases,
        industries: taxonomy.industries,
        platforms: taxonomy.platforms,
        data_types: taxonomy.dataTypes,
      };
    });
    const { data: updated, error: updateError } = await admin.rpc("apply_scrape_source_taxonomy", { p_rows: rows });
    if (updateError) throw updateError;
    processed += Number(updated || 0);
    process.stdout.write(`\rClassified ${processed} Actor sources`);
    if (data.length < pageSize) break;
  }
  process.stdout.write(`\nFinished classifying ${processed} Actor sources.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
