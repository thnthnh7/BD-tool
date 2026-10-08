import assert from "node:assert/strict";
import test from "node:test";
import { cleanHtml, decodeBase64Url, extractEmail } from "@/features/comms/server/provider-normalization";
import { isInsideSendingWindow, nextSendingWindow } from "@/features/comms/server/sequence-schedule";

test("normalizes provider addresses and safe message previews", () => {
  assert.equal(extractEmail("Bizcraw User <USER@Example.com>"), "user@example.com");
  assert.equal(decodeBase64Url(Buffer.from("Xin chào", "utf8").toString("base64url")), "Xin chào");
  assert.equal(cleanHtml("<style>x{}</style><p>Hello&nbsp;<b>there</b></p>"), "Hello there");
});

test("respects the workspace sending window in its configured timezone", () => {
  const window = { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" };
  const mondayMorningUtc = new Date("2026-10-12T02:30:00.000Z");
  assert.equal(isInsideSendingWindow(mondayMorningUtc, "Asia/Ho_Chi_Minh", window), true);
  const sunday = new Date("2026-10-11T02:30:00.000Z");
  const next = nextSendingWindow(sunday, "Asia/Ho_Chi_Minh", window);
  assert.equal(next.toISOString(), "2026-10-12T02:00:00.000Z");
});
