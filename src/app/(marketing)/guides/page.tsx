import { MarketingHubPage } from "@/components/marketing/marketing-index-page";
import { marketingHubs } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingHubs.guides;
export const metadata = createPublicMetadata({ title: "Web Scraping and Lead Generation Guides | Bizcraw", description: page.description, path: page.path });
export default function GuidesPage() { return <MarketingHubPage page={page} />; }
