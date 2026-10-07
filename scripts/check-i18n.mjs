import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src/i18n/messages");
const expectedLocales = ["en", "vi", "zh-CN", "zh-TW", "es", "pt-BR", "fr", "de", "it", "nl", "pl", "tr", "ru", "uk", "ja", "ko", "id", "th", "ar", "hi"];
const flatten = (value, prefix = "") => Object.entries(value).flatMap(([key, child]) => {
  const next = prefix ? `${prefix}.${key}` : key;
  return typeof child === "object" && child !== null ? flatten(child, next) : [[next, child]];
});
const placeholders = (value) => [...String(value).matchAll(/\{([a-zA-Z][\w]*)\s*(?:,|\})/g)].map((match) => match[1]).sort();

const files = new Set((await readdir(root)).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)));
const missingFiles = expectedLocales.filter((locale) => !files.has(locale));
if (missingFiles.length) throw new Error(`Missing locale files: ${missingFiles.join(", ")}`);

const source = new Map(flatten(JSON.parse(await readFile(path.join(root, "en.json"), "utf8"))));
let failed = false;
for (const locale of expectedLocales) {
  const messages = new Map(flatten(JSON.parse(await readFile(path.join(root, `${locale}.json`), "utf8"))));
  const missing = [...source.keys()].filter((key) => !messages.has(key));
  const extra = [...messages.keys()].filter((key) => !source.has(key));
  const invalid = [...source].filter(([key, value]) => messages.has(key) && placeholders(value).join() !== placeholders(messages.get(key)).join()).map(([key]) => key);
  if (extra.length || invalid.length) {
    failed = true;
    console.error(`${locale}: extra=${extra.length}, invalid placeholders=${invalid.length}`);
  } else if (missing.length) {
    console.log(`${locale}: ${messages.size} messages, ${missing.length} fall back to English`);
  } else {
    console.log(`${locale}: ${messages.size} messages OK`);
  }
}
if (failed) process.exit(1);
