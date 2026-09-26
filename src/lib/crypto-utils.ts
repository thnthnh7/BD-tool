import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";

export function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "ws"}-${suffix}`;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken() {
  return randomBytes(24).toString("base64url");
}

export function createPaymentCode() {
  return `BD-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function secretsKey() {
  const raw = process.env.WORKSPACE_SECRETS_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    throw new Error("WORKSPACE_SECRETS_KEY or SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }
  return scryptSync(raw, "leadely-byok", 32);
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretsKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", secretsKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
