import { NextRequest, NextResponse } from "next/server";
import { applySepayPayment } from "@/lib/billing/actions";
import { verifySepaySecret } from "@/lib/billing/sepay";
import { recordHeartbeat } from "@/lib/platform/heartbeat";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    await recordHeartbeat("sepay_webhook", false, "missing webhook secret");
    return NextResponse.json({ success: false, error: "Webhook is not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") || request.headers.get("x-sepay-signature") || "";
  if (!verifySepaySecret(auth)) {
    await recordHeartbeat("sepay_webhook", false, "unauthorized");
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const channel = body.gateway || body.transferType ? "vietqr" : "gateway";
  const result = await applySepayPayment(
    {
      id: body.id as string | number | undefined,
      transferType: body.transferType as string | undefined,
      transferAmount: Number(body.transferAmount ?? body.amount ?? 0),
      code: (body.code as string | null) ?? null,
      content: body.content as string | undefined,
      gateway: body.gateway as string | undefined,
    },
    channel,
  );

  await recordHeartbeat("sepay_webhook", !result.error, result.error || "ok");
  return NextResponse.json({ success: !result.error, ...result });
}
