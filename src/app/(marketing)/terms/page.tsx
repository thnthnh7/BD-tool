import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.terms;
export const metadata = createPublicMetadata({ title: "Bizcraw Terms of Service", description: page.description, path: page.path });
export default function TermsPage() { return <MarketingInfoPage page={page} />; }
