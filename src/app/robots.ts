import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/app", "/app/", "/api/", "/auth/", "/invite/", "/onboarding", "/update-password"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      {
        userAgent: ["Googlebot", "Google-Extended", "bingbot", "OAI-SearchBot", "ChatGPT-User", "GPTBot"],
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: "https://bizcraw.com/sitemap.xml",
    host: "https://bizcraw.com",
  };
}
