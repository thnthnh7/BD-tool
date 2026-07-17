import { createId } from "./ids";
import type { DeliverableItem, QuoteItem } from "./types";

/** Rule-based: turn commercial modules into deliverable feature rows for appendix. */
export function deliverablesFromItems(items: QuoteItem[]): DeliverableItem[] {
  return items.map((item) => ({
    id: createId("deliv"),
    name: item.name,
    description: item.description,
    moduleName: item.name,
    referencePrice: item.qty * item.unitPrice,
    priority: "Cao" as const,
    effortDays: 1,
    notes: "",
  }));
}
