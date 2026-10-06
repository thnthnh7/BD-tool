import { notFound, permanentRedirect } from "next/navigation";
import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { seoPages } from "@/content/seo-pages";
import { createPublicMetadata } from "@/lib/seo";

const allowed = ["scraping", "data-library", "ai-sales-agent"] as const;
export const dynamicParams = false;
export function generateStaticParams() { return allowed.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = seoPages[slug === "data-library" ? "features/scraping" : `features/${slug}`]; return page ? createPublicMetadata({ title: page.title, description: page.description, path: page.path }) : {}; }
export default async function FeatureSeoPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (slug === "data-library") permanentRedirect("/features/scraping"); const page = seoPages[`features/${slug}`]; if (!page || !allowed.includes(slug as typeof allowed[number])) notFound(); return <SeoContentPage page={page} />; }
