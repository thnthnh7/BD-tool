import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { seoPages } from "@/content/seo-pages";
import { createPublicMetadata } from "@/lib/seo";

const allowed = ["web-scraping", "web-scraping-for-lead-generation", "scrape-business-leads", "google-maps-lead-scraper", "data-to-crm"] as const;

export const dynamicParams = false;
export function generateStaticParams() { return allowed.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = seoPages[slug];
  if (!page) return {};
  return createPublicMetadata({ title: page.title, description: page.description, path: page.path });
}

export default async function TopLevelSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = seoPages[slug];
  if (!page || !allowed.includes(slug as typeof allowed[number])) notFound();
  return <SeoContentPage page={page} />;
}
