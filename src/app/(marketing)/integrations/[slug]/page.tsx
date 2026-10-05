import { notFound } from "next/navigation";
import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { seoPages } from "@/content/seo-pages";
import { createPublicMetadata } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return [{ slug: "apify" }]; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = seoPages[`integrations/${slug}`]; return page ? createPublicMetadata({ title: page.title, description: page.description, path: page.path }) : {}; }
export default async function IntegrationSeoPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const page = seoPages[`integrations/${slug}`]; if (!page || slug !== "apify") notFound(); return <SeoContentPage page={page} />; }
