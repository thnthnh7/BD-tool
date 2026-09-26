import { createClient } from "@/lib/supabase/server";
import { embedTexts, vectorLiteral } from "@/features/knowledge/server/embedding";

export type KnowledgeEvidence = {
  documentId: string;
  fileName: string;
  content: string;
  score: number;
};

export async function retrieveKnowledge(query: string, limit = 8): Promise<KnowledgeEvidence[]> {
  const supabase = await createClient();
  const [embedding] = await embedTexts([query]);
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: vectorLiteral(embedding),
    query_text: query.slice(0, 2000),
    match_count: limit,
  });
  if (error) {
    console.warn("knowledge.retrieve failed", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    documentId: row.document_id,
    fileName: row.file_name,
    content: row.content,
    score: Number(row.similarity || 0) * 0.72 + Number(row.text_rank || 0) * 0.28,
  }));
}
