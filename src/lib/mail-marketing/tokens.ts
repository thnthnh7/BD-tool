import { createHmac, timingSafeEqual } from "node:crypto";

export type MailTokenPayload = { purpose: "unsubscribe" | "click" | "preferences"; userId: string; email: string; deliveryId?: string; path?: string; exp: number };

function secret() {
  const value = process.env.EMAIL_SIGNING_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error("EMAIL_SIGNING_SECRET or CRON_SECRET is required");
  return value;
}

export function signMailToken(payload: MailTokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyMailToken(token: string, purpose: MailTokenPayload["purpose"]): MailTokenPayload | null {
  try {
    const [body, received] = token.split(".");
    if (!body || !received) return null;
    const expected = createHmac("sha256", secret()).update(body).digest("base64url");
    const left = Buffer.from(received);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MailTokenPayload;
    return payload.purpose === purpose && payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}
