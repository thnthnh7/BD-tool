import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { seoPages } from "@/content/seo-pages";
import { createPublicMetadata } from "@/lib/seo";

const allowed = ["how-to-build-a-prospect-list-with-web-scraping", "web-scraping-vs-data-enrichment"] as const;
export const dynamicParams = false;
export function generateStaticParams() { return allowed.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = seoPages[`guides/${slug}`]; return page ? createPublicMetadata({ title: page.title, description: page.description, path: page.path }) : {}; }
export default async function GuideSeoPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = seoPages[`guides/${slug}`]; if (!page || !allowed.includes(slug as typeof allowed[number])) notFound(); return <SeoContentPage page={page} />; }
