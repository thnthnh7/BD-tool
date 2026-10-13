import assert from "node:assert/strict";
import test from "node:test";
import { categoryAllowed, renderTemplate, triggerEligible } from "@/lib/mail-marketing/rules";
import { signMailToken, verifyMailToken } from "@/lib/mail-marketing/tokens";

const DAY = 86_400_000;

test("lifecycle triggers require the matching product state", () => {
  const now = Date.now();
  const base = { grantedAt: now - 8 * DAY, accessEndsAt: now + 20 * DAY, lastSeenAt: now - 8 * DAY, sourceInstalledAt: null, firstScrapeAt: null };
  assert.equal(triggerEligible("beta_no_source", 24, base, now), true);
  assert.equal(triggerEligible("beta_no_scrape", 48, { ...base, sourceInstalledAt: now - 3 * DAY }, now), true);
  assert.equal(triggerEligible("beta_first_value", 0, { ...base, firstScrapeAt: now - DAY }, now), true);
  assert.equal(triggerEligible("beta_inactive", 168, base, now), true);
  assert.equal(triggerEligible("beta_expiry_14", 0, { ...base, accessEndsAt: now + 10 * DAY }, now), true);
  assert.equal(triggerEligible("beta_expiry_2", 0, { ...base, accessEndsAt: now + DAY }, now), true);
});

test("consent and global unsubscribe gate optional categories", () => {
  const off = { product_tips: false, beta_updates: false, announcements: false, unsubscribed_all: false };
  assert.equal(categoryAllowed("service", off), true);
  assert.equal(categoryAllowed("product_tips", off), false);
  assert.equal(categoryAllowed("product_tips", { ...off, product_tips: true }), true);
  assert.equal(categoryAllowed("service", { ...off, unsubscribed_all: true }), false);
});

test("templates replace known variables without evaluating content", () => {
  assert.equal(renderTemplate("Hi {{ first_name }}, #{{position}}", { first_name: "Ana", position: 7 }), "Hi Ana, #7");
});

test("signed mail tokens reject tampering and expiry", () => {
  process.env.EMAIL_SIGNING_SECRET = "test-secret-with-enough-entropy";
  const token = signMailToken({ purpose: "unsubscribe", userId: "u1", email: "a@example.com", exp: Date.now() + 10_000 });
  assert.equal(verifyMailToken(token, "unsubscribe")?.userId, "u1");
  assert.equal(verifyMailToken(`${token}x`, "unsubscribe"), null);
  const expired = signMailToken({ purpose: "unsubscribe", userId: "u1", email: "a@example.com", exp: Date.now() - 1 });
  assert.equal(verifyMailToken(expired, "unsubscribe"), null);
});
