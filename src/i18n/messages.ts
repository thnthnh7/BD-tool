import type { AppLocale } from "./config";
import en from "./messages/en.json";
import vi from "./messages/vi.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.json";
import es from "./messages/es.json";
import ptBR from "./messages/pt-BR.json";
import fr from "./messages/fr.json";
import de from "./messages/de.json";
import it from "./messages/it.json";
import nl from "./messages/nl.json";
import pl from "./messages/pl.json";
import tr from "./messages/tr.json";
import ru from "./messages/ru.json";
import uk from "./messages/uk.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import id from "./messages/id.json";
import th from "./messages/th.json";
import ar from "./messages/ar.json";
import hi from "./messages/hi.json";

type MessageTree = { [key: string]: string | MessageTree };

const catalogs = {
  en, vi, "zh-CN": zhCN, "zh-TW": zhTW, es, "pt-BR": ptBR, fr, de, it, nl,
  pl, tr, ru, uk, ja, ko, id, th, ar, hi,
} satisfies Record<AppLocale, object>;

function isTree(value: unknown): value is MessageTree {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** English is the catalog. A locale only overrides the keys it has translated. */
function mergeMessages(base: MessageTree, overlay: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (isTree(current) && isTree(value)) result[key] = mergeMessages(current, value);
    else if (typeof value === "string" && value.trim()) result[key] = value;
  }
  return result;
}

export function getMessages(locale: AppLocale): typeof en {
  if (locale === "en") return en;
  return mergeMessages(en as unknown as MessageTree, catalogs[locale] as MessageTree) as typeof en;
}
