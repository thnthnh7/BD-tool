import { MarketingHubPage } from "@/components/marketing/marketing-index-page";
import { marketingHubs } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingHubs.solutions;
export const metadata = createPublicMetadata({ title: "Web Scraping Solutions for Sales | Bizcraw", description: page.description, path: page.path });
export default function SolutionsPage() { return <MarketingHubPage page={page} />; }
