import { createHmac, timingSafeEqual } from "crypto";
import { getBillingProviderConfig } from "@/lib/billing/config";

export async function vietqrImageUrl(paymentCode: string, amount: number) {
  const config = await getBillingProviderConfig("sepay");
  if (!config.enabled) return undefined;
  const acc = config.public.bankAccount || "";
  const bank = config.public.bankName || "vietcombank";
  if (!acc) return undefined;
  return `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${amount}&des=${encodeURIComponent(paymentCode)}`;
}

export async function verifySepaySecret(headerValue: string | null) {
  const config = await getBillingProviderConfig("sepay");
  const expected = config.credentials.webhookSecret;
  if (!config.enabled || !expected) return false;
  const provided = headerValue?.replace(/^Apikey\s+/i, "") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function gatewaySignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
