import { MarketingHubPage } from "@/components/marketing/marketing-index-page";
import { marketingHubs } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingHubs.integrations;
export const metadata = createPublicMetadata({ title: "Bizcraw Integrations | Scraping, CRM and AI", description: page.description, path: page.path });
export default function IntegrationsPage() { return <MarketingHubPage page={page} />; }
