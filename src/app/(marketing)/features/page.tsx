import { MarketingHubPage } from "@/components/marketing/marketing-index-page";
import { marketingHubs } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingHubs.features;
export const metadata = createPublicMetadata({ title: "Bizcraw Features | Scraping, Data and AI", description: page.description, path: page.path });
export default function FeaturesPage() { return <MarketingHubPage page={page} />; }
