import { MarketingHubPage } from "@/components/marketing/marketing-index-page";
import { marketingHubs } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingHubs.compare;
export const metadata = createPublicMetadata({ title: "Compare Bizcraw | Product and Workflow Comparisons", description: page.description, path: page.path });
export default function ComparePage() { return <MarketingHubPage page={page} />; }
