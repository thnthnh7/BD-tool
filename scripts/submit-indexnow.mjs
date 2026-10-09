const site = process.env.INDEXNOW_SITE ?? "https://bizcraw.com";
const host = new URL(site).host;
const key = "8b332edf6c49fd4946d4c711423961ef";
const keyLocation = `${site}/${key}.txt`;

async function sitemapUrls() {
  const response = await fetch(`${site}/sitemap.xml`, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not load sitemap: HTTP ${response.status}`);
  const body = await response.text();
  return [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).filter((url) => new URL(url).host === host);
}

const urls = [...new Set(await sitemapUrls())];
if (!urls.length) throw new Error("The sitemap did not contain any URLs for the configured host.");

let response;
let detail = "";
for (let attempt = 1; attempt <= 6; attempt += 1) {
  response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
  });
  if ([200, 202].includes(response.status)) break;
  detail = (await response.text()).slice(0, 500);
  if (response.status !== 403 || attempt === 6) break;
  console.log(`IndexNow key verification is pending (attempt ${attempt}/6); retrying in 30 seconds.`);
  await new Promise((resolve) => setTimeout(resolve, 30_000));
}

if (!response || ![200, 202].includes(response.status)) throw new Error(`IndexNow rejected ${urls.length} URLs: HTTP ${response?.status ?? "unknown"} ${detail}`);

console.log(`IndexNow accepted ${urls.length} URLs with HTTP ${response.status}.`);
