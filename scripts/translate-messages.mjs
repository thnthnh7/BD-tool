import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src/i18n/messages");
const source = JSON.parse(await readFile(path.join(root, "en.json"), "utf8"));
const targets = ["zh-CN", "zh-TW", "es", "pt-BR", "fr", "de", "it", "nl", "pl", "tr", "ru", "uk", "ja", "ko", "id", "th", "ar", "hi"];
const googleCodes = { "zh-CN": "zh-CN", "zh-TW": "zh-TW", "pt-BR": "pt" };

const protectedTerms = ["Bizcraw", "Apify", "OAuth", "API", "CRM", "RAM", "USD", "PDPA", "JSON", "LinkedIn"];

function protect(value) {
  const values = [];
  let text = value.replace(/\{[^{}]+\}/g, (match) => {
    const token = `ZXQPH${values.length}QXZ`;
    values.push(match);
    return token;
  });
  for (const term of protectedTerms) {
    const token = `ZXQPH${values.length}QXZ`;
    if (text.includes(term)) {
      values.push(term);
      text = text.replaceAll(term, token);
    }
  }
  return { text, values };
}

function restore(value, values) {
  let text = value;
  values.forEach((original, index) => {
    const token = `ZXQPH${index}QXZ`;
    text = text.replaceAll(token, original).replaceAll(token.toLowerCase(), original);
    text = text.replace(new RegExp(`ZXQPH\\s*${index}\\s*QXZ`, "gi"), original);
  });
  return text;
}

async function translateText(value, locale, attempt = 0) {
  if (value.includes("plural,")) return value;
  const { text, values } = protect(value);
  const target = googleCodes[locale] || locale;
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(text)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const translated = typeof payload[0] === "string" ? payload[0] : payload[0].map((part) => part[0]).join("");
    return restore(translated, values);
  } catch (error) {
    if (attempt >= 7) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    return translateText(value, locale, attempt + 1);
  }
}

async function mapObject(input, locale, existing = {}) {
  const entries = Object.entries(input);
  const output = {};
  for (let index = 0; index < entries.length; index += 8) {
    const chunk = entries.slice(index, index + 8);
    const translated = await Promise.all(chunk.map(async ([key, value]) => [
      key,
      typeof value === "string"
        ? (typeof existing[key] === "string" ? existing[key] : await translateText(value, locale))
        : await mapObject(value, locale, typeof existing[key] === "object" && existing[key] ? existing[key] : {}),
    ]));
    Object.assign(output, Object.fromEntries(translated));
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return output;
}

for (const locale of targets) {
  const destination = path.join(root, `${locale}.json`);
  let existing = {};
  try {
    await access(destination);
    existing = JSON.parse(await readFile(destination, "utf8"));
  } catch {}
  const translated = await mapObject(source, locale, existing);
  await writeFile(destination, `${JSON.stringify(translated, null, 2)}\n`);
  console.log(`Translated ${locale}`);
}
