import { MarketingInfoPage } from "@/components/marketing/marketing-index-page";
import { marketingInfoPages } from "@/content/marketing-pages";
import { createPublicMetadata, SITE_URL } from "@/lib/seo";

const page = marketingInfoPages.whatIsBizcraw;
const softwareId = `${SITE_URL}/#software`;

export const metadata = createPublicMetadata({
  title: "What Is Bizcraw? | Web Scraping and AI Sales Workspace",
  description: page.description,
  path: page.path,
});

const entitySchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Bizcraw",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/bizcraw-logo.png`,
      description: "The organization behind the Bizcraw web scraping and AI sales workspace.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: "Bizcraw",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Web scraping and sales intelligence",
      operatingSystem: "Web",
      description: page.intro,
      publisher: { "@id": `${SITE_URL}/#organization` },
      creator: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: `${SITE_URL}${page.path}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default function WhatIsBizcrawPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(entitySchema).replace(/</g, "\\u003c") }}
      />
      <MarketingInfoPage page={page} />
    </>
  );
}
