import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.acceptableUse;
export const metadata = createPublicMetadata({ title: "Bizcraw Acceptable Use Policy", description: page.description, path: page.path });
export default function AcceptableUsePage() { return <MarketingInfoPage page={page} />; }
