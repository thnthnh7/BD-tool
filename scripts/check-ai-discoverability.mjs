const site = (process.env.DISCOVERABILITY_SITE ?? "https://bizcraw.com").replace(/\/$/, "");
const canonicalSite = "https://bizcraw.com";
const expectedPages = [
  "/what-is-bizcraw", "/features", "/solutions", "/pricing", "/mcp",
  "/compare",
  "/compare/bizcraw-vs-apify", "/compare/bizcraw-vs-clay", "/compare/bizcraw-vs-apollo",
];

async function read(path) {
  const response = await fetch(`${site}${path}`, { redirect: "follow" });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return text;
}

const [robots, sitemap, llms, llmsFull] = await Promise.all([
  read("/robots.txt"), read("/sitemap.xml"), read("/llms.txt"), read("/llms-full.txt"),
]);

for (const bot of ["Googlebot", "Google-Extended", "OAI-SearchBot", "ChatGPT-User", "GPTBot", "bingbot"]) {
  if (!robots.toLowerCase().includes(`user-agent: ${bot}`.toLowerCase())) throw new Error(`robots.txt is missing ${bot}`);
}
for (const path of expectedPages) {
  if (!sitemap.includes(`${canonicalSite}${path}`)) throw new Error(`sitemap.xml is missing ${path}`);
  if (!llmsFull.includes(`${canonicalSite}${path}`)) throw new Error(`llms-full.txt is missing ${path}`);
}
if (!llms.includes(`${canonicalSite}/llms-full.txt`)) throw new Error("llms.txt does not link to llms-full.txt");

const pages = await Promise.all(expectedPages.map(async (path) => ({ path, html: await read(path) })));
for (const { path, html } of pages) {
  if (!/<link[^>]+rel=["']canonical["']/i.test(html)) throw new Error(`${path} has no canonical link`);
  if (!html.includes("application/ld+json")) throw new Error(`${path} has no JSON-LD`);
}

console.log(`Discoverability checks passed for ${expectedPages.length} public pages at ${site}.`);
