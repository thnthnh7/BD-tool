import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata } from "@/lib/seo";

const page = marketingInfoPages.contact;
export const metadata = createPublicMetadata({ title: "Contact Bizcraw", description: page.description, path: page.path });
export default function ContactPage() { return <MarketingInfoPage page={page} />; }
