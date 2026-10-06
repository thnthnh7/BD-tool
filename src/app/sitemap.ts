import type { MetadataRoute } from "next";
import { marketingIndexPaths } from "@/content/marketing-pages";
import { seoPageList } from "@/content/seo-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-06");
  return [
    { url: "https://bizcraw.com", lastModified, changeFrequency: "weekly", priority: 1, images: ["https://bizcraw.com/landing/bizcraw-source-library-hero.png"] },
    { url: "https://bizcraw.com/pricing", lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...marketingIndexPaths.map((path) => ({
      url: `https://bizcraw.com${path}`,
      lastModified,
      changeFrequency: path === "/privacy" || path === "/terms" ? "monthly" as const : "weekly" as const,
      priority: path === "/features" || path === "/solutions" ? 0.9 : 0.7,
    })),
    ...seoPageList.map((page) => ({
      url: `https://bizcraw.com${page.path}`,
      lastModified,
      changeFrequency: page.path.startsWith("/guides/") ? "monthly" as const : "weekly" as const,
      priority: page.path.startsWith("/guides/") ? 0.7 : 0.8,
      images: [`https://bizcraw.com${page.image}`],
    })),
  ];
}
