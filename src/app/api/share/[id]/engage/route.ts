import { NextRequest, NextResponse } from "next/server";
import { admit } from "@/lib/admission";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidShareId } from "@/lib/share-id";
import type { SharedQuotePayload } from "@/lib/share";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  let body: { event_type?: string; section?: string; viewer_session_id?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const eventType = body.event_type || "opened";
  if (!["opened", "section_viewed", "pdf_downloaded", "accepted", "rejected"].includes(eventType)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const gate = await admit(supabase, id, "share_engage", 30, 60);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status ?? 503 });
  }
  const { data: share } = await supabase.from("public_quotes").select("workspace_id, payload").eq("id", id).maybeSingle();
  if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  const payload = share.payload as unknown as SharedQuotePayload;
  const quoteId = payload?.quote?.id || null;
  let dealId: string | null = payload?.quote?.dealId || null;
  if (quoteId && !dealId) {
    const { data: quote } = await supabase.from("quotes").select("deal_id, title").eq("id", quoteId).maybeSingle();
    dealId = quote?.deal_id || null;
  }

  await supabase.from("quote_engagement_events").insert({
    workspace_id: share.workspace_id,
    quote_id: quoteId,
    public_quote_id: id,
    deal_id: dealId,
    viewer_session_id: body.viewer_session_id || null,
    event_type: eventType,
    section: body.section || null,
  });

  if (eventType === "opened" && quoteId) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("notifications")
      .select("id")
      .eq("workspace_id", share.workspace_id)
      .eq("kind", "quote_viewed")
      .eq("entity_id", quoteId)
      .gte("created_at", since)
      .limit(1);
    if (!recent?.length) {
      await supabase.from("activities").insert({
        workspace_id: share.workspace_id,
        quote_id: quoteId,
        deal_id: dealId,
        activity_type: "quote_viewed",
        title: `Quote viewed: ${payload.quote?.title || id}`,
        is_system: true,
      });
      await supabase.from("notifications").insert({
        workspace_id: share.workspace_id,
        user_id: null,
        title: "Quote viewed",
        body: `${payload.quote?.title || "A quote"} was opened.`,
        kind: "quote_viewed",
        entity_type: "quote",
        entity_id: quoteId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
