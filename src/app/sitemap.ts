import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://bizcraw.com", lastModified: new Date("2026-10-05"), changeFrequency: "weekly", priority: 1 }];
}
