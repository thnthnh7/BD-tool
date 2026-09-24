import { createHmac, timingSafeEqual } from "crypto";

export function vietqrImageUrl(paymentCode: string, amount: number) {
  const acc = process.env.SEPAY_BANK_ACCOUNT || "";
  const bank = process.env.SEPAY_BANK_NAME || "vietcombank";
  return `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${amount}&des=${encodeURIComponent(paymentCode)}`;
}

export function verifySepaySecret(headerValue: string | null) {
  const expected = process.env.SEPAY_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = headerValue?.replace(/^Apikey\s+/i, "") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function gatewaySignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
