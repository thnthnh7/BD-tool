import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.about;
export const metadata = createPublicMetadata({ title: "About Bizcraw | Web Scraping and AI Sales Workspace", description: page.description, path: page.path });
export default function AboutPage() { return <MarketingInfoPage page={page} />; }
