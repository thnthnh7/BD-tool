import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { slimSharedPayload, type SharedQuotePayload } from "@/lib/share";
import { createShareId, isValidShareId } from "@/lib/share-id";

export const runtime = "nodejs";

function isPayload(value: unknown): value is SharedQuotePayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return Boolean(body.settings && body.quote);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPayload(body)) {
    return NextResponse.json({ error: "Missing settings or quote" }, { status: 400 });
  }

  const payload = slimSharedPayload(body, { stripDataLogos: false });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createShareId();
    if (!isValidShareId(id)) continue;
    const { error } = await supabase.from("public_quotes").insert({
      id,
      workspace_id: membership.workspace_id,
      payload: payload as never,
    });
    if (!error) {
      const origin = request.nextUrl.origin;
      return NextResponse.json({ id, url: `${origin}/p/${id}` });
    }
  }

  return NextResponse.json({ error: "Failed to create short link" }, { status: 500 });
}
