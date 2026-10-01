import { createHash } from "node:crypto";

export function mcpAlertFingerprint(issues: string[]) {
  return createHash("sha256").update(JSON.stringify(issues)).digest("hex");
}

export function shouldSuppressMcpAlert(input: { fingerprint: string; previousFingerprint: string | null; previousSentAt: string | null; now: Date; cooldownMinutes: number }) {
  if (input.previousFingerprint !== input.fingerprint || !input.previousSentAt) return false;
  return input.now.getTime() - new Date(input.previousSentAt).getTime() < input.cooldownMinutes * 60_000;
}
