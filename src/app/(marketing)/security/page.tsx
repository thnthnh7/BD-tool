import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.security;
export const metadata = createPublicMetadata({ title: "Bizcraw Security", description: page.description, path: page.path });
export default function SecurityPage() { return <MarketingInfoPage page={page} />; }
