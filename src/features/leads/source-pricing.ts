export type ChargeEvent = {
  eventTitle?: string;
  eventPriceUsd?: number;
  eventTieredPricingUsd?: Record<string, { tieredEventPriceUsd?: number }>;
  isPrimaryEvent?: boolean;
  isOneTimeEvent?: boolean;
};
export type ActorPricing = {
  pricingModel?: string;
  startedAt?: string;
  pricingPerEvent?: { actorChargeEvents?: Record<string, ChargeEvent> };
};

export function summarizePricing(info?: ActorPricing) {
  if (info?.pricingModel !== "PAY_PER_EVENT") return null;
  const events = Object.entries(info.pricingPerEvent?.actorChargeEvents || {}).map(([key, event]) => ({
    key, title: event.eventTitle || key, primary: Boolean(event.isPrimaryEvent),
    oneTime: Boolean(event.isOneTimeEvent),
    price: event.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? event.eventPriceUsd,
  })).filter((event) => typeof event.price === "number" && Number.isFinite(event.price) && event.price >= 0);
  const primary = events.find((event) => event.primary) || events.find((event) => !event.oneTime) || events[0];
  if (!primary) return null;
  const usd = (price: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(price);
  return {
    amount: usd(primary.price! * (primary.oneTime ? 1 : 1000)),
    unit: `${primary.oneTime ? "1" : "1.000"} ${primary.title}`,
    events: events.map((event) => ({ title: event.title, amount: usd(event.price!), unit: "event" })),
  };
}
