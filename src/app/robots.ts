import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/app/", "/api/", "/auth/", "/invite/", "/onboarding", "/update-password"],
    },
    sitemap: "https://bizcraw.com/sitemap.xml",
    host: "https://bizcraw.com",
  };
}
