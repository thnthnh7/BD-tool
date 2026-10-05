"use server";

import { requireModule } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { completeChat } from "@/features/ai/server/complete";
import { asJoined, formOptionalId, formText } from "@/lib/crm";
import type { Database } from "@/lib/database.types";
import { recordActivity, withWorkspace } from "@/lib/events";
import { saveContractDocx } from "@/lib/quotes/files";

export async function listDealQuotes(dealId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("quotes")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("deal_id", dealId)
    .order("revision_number", { ascending: false });
  return data || [];
}

export async function listQuoteEngagement(quoteId: string) {
  const { context, supabase } = await withWorkspace();
  const { data } = await supabase
    .from("quote_engagement_events")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("quote_id", quoteId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function createQuoteRevisionAction(formData: FormData) {
  await requireModule("quotes"); // createQuoteRevisionAction
  const { context, supabase } = await withWorkspace();
  const quoteId = formText(formData, "quote_id");
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!quote) return { error: "Không thấy quote." };
  const nextRevision = (quote.revision_number || 1) + 1;
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      ...quote,
      id: crypto.randomUUID(),
      public_id: `Q-${Date.now().toString(36).toUpperCase()}`,
      revision_number: nextRevision,
      supersedes_quote_id: quote.id,
      status: "draft",
      quote_status_v2: "draft",
      sent_at: null,
      accepted_at: null,
      rejected_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được revision." };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    dealId: quote.deal_id,
    quoteId: data.id,
    activityType: "quote_created",
    title: `Created quote revision ${nextRevision}`,
  });
  revalidatePath("/app/quotes");
  return { ok: true as const, id: data.id };
}

export async function generateDealIntelAction(formData: FormData) {
  await requireModule("deals"); // generateDealIntelAction
  const { context, supabase } = await withWorkspace();
  const dealId = formText(formData, "deal_id");
  const { data: deal } = await supabase
    .from("deals")
    .select("*, companies(name, industry), contacts:primary_contact_id(display_name, job_title)")
    .eq("id", dealId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!deal) return { error: "Không thấy deal." };
  const row = asJoined<
    Database["public"]["Tables"]["deals"]["Row"] & {
      companies: { name: string; industry: string } | null;
      contacts: { display_name: string; job_title: string } | null;
    }
  >(deal);
  const [{ data: activities }, { data: quotes }, { data: stakeholders }] = await Promise.all([
    supabase.from("activities").select("title, body, activity_type, occurred_at").eq("deal_id", dealId).order("occurred_at", { ascending: false }).limit(12),
    supabase.from("quotes").select("title, status, revision_number, updated_at").eq("deal_id", dealId),
    supabase.from("deal_contacts").select("stakeholder_role, contacts(display_name, job_title)").eq("deal_id", dealId),
  ]);
  const { data: engagement } = await supabase
    .from("quote_engagement_events")
    .select("event_type, occurred_at")
    .eq("deal_id", dealId)
    .order("occurred_at", { ascending: false })
    .limit(20);

  const result = await completeChat({
    messages: [
      {
        role: "user",
        content: `You are a BD coach. Return JSON only: {"summary":"...","nextBestAction":"...","risks":["..."]}
Deal: ${JSON.stringify({
          title: row.title,
          amount: row.amount,
          company: row.companies,
          contact: row.contacts,
          description: row.description,
        })}
Stakeholders: ${JSON.stringify(stakeholders || [])}
Quotes: ${JSON.stringify(quotes || [])}
Activities: ${JSON.stringify(activities || [])}
Engagement: ${JSON.stringify(engagement || [])}`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 700,
    consumePlatformQuota: true,
    operation: "deal_analysis",
  });
  if ("error" in result) return { error: result.error };
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    dealId,
    companyId: row.company_id,
    activityType: "ai_recommendation",
    title: "AI Deal Summary",
    body: result.data.content,
    isSystem: true,
  });
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true as const };
}

export async function listContracts(dealId?: string) {
  const { context, supabase } = await withWorkspace();
  let query = supabase.from("contracts").select("*, deals(title), companies(name)").eq("workspace_id", context.workspaceId).order("updated_at", { ascending: false });
  if (dealId) query = query.eq("deal_id", dealId);
  const { data } = await query;
  return data || [];
}

export async function createContractAction(formData: FormData) {
  await requireModule("contracts"); // createContractAction
  const { context, supabase } = await withWorkspace();
  const dealId = formText(formData, "deal_id");
  const title = formText(formData, "title");
  if (!dealId || !title) return { error: "Cần deal và tiêu đề." };
  const docx = formData.get("docx");
  const hasDocx = docx instanceof File && docx.size > 0;
  if (hasDocx && docx.size > 20 * 1024 * 1024) return { error: "File cần nhỏ hơn 20 MB." };
  if (hasDocx && !docx.name.toLowerCase().endsWith(".docx")) return { error: "Hợp đồng chỉ nhận DOCX." };
  const { data: deal } = await supabase.from("deals").select("company_id").eq("id", dealId).maybeSingle();
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      workspace_id: context.workspaceId,
      deal_id: dealId,
      quote_id: formOptionalId(formData, "quote_id"),
      company_id: deal?.company_id || formOptionalId(formData, "company_id"),
      title,
      status: formText(formData, "status") || "draft",
      notes: formText(formData, "notes"),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Không tạo được hợp đồng." };
  if (hasDocx) {
    const uploaded = await saveContractDocx(data.id, docx);
    if (!uploaded.ok) return { error: `Đã tạo hợp đồng nhưng không lưu được file: ${uploaded.error}` };
  }
  await recordActivity({
    workspaceId: context.workspaceId,
    actorUserId: context.userId,
    dealId,
    companyId: deal?.company_id,
    activityType: "contract_created",
    title: `Contract created: ${title}`,
  });
  revalidatePath("/app/contracts");
  return { ok: true as const, id: data.id };
}

export async function updateContractAction(formData: FormData) {
  await requireModule("contracts"); // updateContractAction
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "id");
  const status = formText(formData, "status") || "draft";
  const { error } = await supabase
    .from("contracts")
    .update({
      title: formText(formData, "title"),
      status,
      notes: formText(formData, "notes"),
      signed_at: status === "signed" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("workspace_id", context.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/app/contracts");
  return { ok: true as const };
}
