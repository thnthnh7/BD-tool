import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { seoPages } from "@/content/seo-pages";
import { createPublicMetadata } from "@/lib/seo";

const allowed = ["bizcraw-vs-apify", "bizcraw-vs-clay", "bizcraw-vs-apollo"] as const;

export const dynamicParams = false;
export function generateStaticParams() { return allowed.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = seoPages[`compare/${slug}`];
  return page ? createPublicMetadata({ title: page.title, description: page.description, path: page.path }) : {};
}

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = seoPages[`compare/${slug}`];
  if (!page || !allowed.includes(slug as typeof allowed[number])) notFound();
  return <SeoContentPage page={page} />;
}
