const site = process.env.INDEXNOW_SITE ?? "https://bizcraw.com";
const host = new URL(site).host;
const key = "1fb61159111a3d8bd4535287e38be0f4";
const keyLocation = `${site}/${key}.txt`;

async function sitemapUrls() {
  const response = await fetch(`${site}/sitemap.xml`, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not load sitemap: HTTP ${response.status}`);
  const body = await response.text();
  return [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).filter((url) => new URL(url).host === host);
}

const urls = [...new Set(await sitemapUrls())];
if (!urls.length) throw new Error("The sitemap did not contain any URLs for the configured host.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
});

if (![200, 202].includes(response.status)) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`IndexNow rejected ${urls.length} URLs: HTTP ${response.status} ${detail}`);
}

console.log(`IndexNow accepted ${urls.length} URLs with HTTP ${response.status}.`);
