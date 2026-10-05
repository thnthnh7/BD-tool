import type { Metadata } from "next";

export const SITE_URL = "https://bizcraw.com";
export const SOCIAL_IMAGE = "/landing/bizcraw-source-library-hero.png";

export const privatePageMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export function createPublicMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Bizcraw",
      type: "website",
      images: [{ url: SOCIAL_IMAGE, width: 1530, height: 900, alt: "Bizcraw web scraping source library" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE] },
  };
}
