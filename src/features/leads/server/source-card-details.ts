import { summarizePricing, type ActorPricing } from "@/features/leads/source-pricing";

// Public metadata only. Cache each Actor independently; never start an Actor to read prices.
export async function sourceCardDetails(slug: string) {
  try {
    const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(slug.replace("/", "~"))}`, {
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const { data } = await response.json() as { data?: { pictureUrl?: string; pricingInfos?: ActorPricing[] } };
    const current = data?.pricingInfos?.filter((info) => info.startedAt && Date.parse(info.startedAt) <= Date.now())
      .sort((a, b) => Date.parse(b.startedAt!) - Date.parse(a.startedAt!))[0];
    return { picture: data?.pictureUrl, pricing: summarizePricing(current) };
  } catch {
    return null;
  }
}
