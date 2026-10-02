import assert from "node:assert/strict";

const baseUrl = (process.env.BETA_TEST_BASE_URL || "https://bizcraw.com").replace(/\/$/, "");

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    ...init,
  });
  return response;
}

for (const path of ["/", "/login", "/signup", "/forgot"]) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${path} is missing X-Frame-Options`);
  assert.ok(response.headers.get("content-security-policy"), `${path} is missing CSP`);
}

const health = await request("/api/health");
assert.equal(health.status, 200, `/api/health returned ${health.status}`);
assert.equal((await health.json()).status, "ok", "database health check failed");

const metadata = await request("/.well-known/oauth-authorization-server");
assert.equal(metadata.status, 200, `OAuth metadata returned ${metadata.status}`);
const oauth = await metadata.json();
assert.equal(oauth.issuer, baseUrl, `OAuth issuer is ${oauth.issuer}`);

const legacyHost = await fetch("https://www.bizcraw.com", {
  redirect: "manual",
  signal: AbortSignal.timeout(15_000),
});
assert.equal(legacyHost.status, 308, `www redirect returned ${legacyHost.status}`);
assert.equal(legacyHost.headers.get("location"), `${baseUrl}/`, "www redirect target is incorrect");

console.log(`Beta production smoke test passed for ${baseUrl}`);
