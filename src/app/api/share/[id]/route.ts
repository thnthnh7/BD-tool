import { NextResponse } from "next/server";
import { loadSharedQuote } from "@/lib/share-store";
import { isValidShareId } from "@/lib/share-id";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  const payload = await loadSharedQuote(id);
  if (!payload) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-cache",
    },
  });
}
