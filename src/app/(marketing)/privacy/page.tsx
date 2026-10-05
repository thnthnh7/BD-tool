import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.privacy;
export const metadata = createPublicMetadata({ title: "Bizcraw Privacy Notice", description: page.description, path: page.path });
export default function PrivacyPage() { return <MarketingInfoPage page={page} />; }
