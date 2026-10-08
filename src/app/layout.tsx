import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { mantineHtmlProps } from "@mantine/core";
import { LeadelyProvider } from "@/components/leadely-provider";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { SOCIAL_IMAGE } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const deckSans = Be_Vietnam_Pro({
  variable: "--font-deck",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const deckSerif = Source_Serif_4({
  variable: "--font-deck-serif",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bizcraw.com"),
  title: { default: "Bizcraw", template: "%s | Bizcraw" },
  description: "AI sales workspace for lead discovery, CRM operations, deals, quotes and contracts.",
  applicationName: "Bizcraw",
  authors: [{ name: "Bizcraw" }],
  creator: "Bizcraw",
  publisher: "Bizcraw",
  icons: {
    icon: [{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    siteName: "Bizcraw",
    type: "website",
    images: [{ url: SOCIAL_IMAGE, width: 1530, height: 900, alt: "Bizcraw web scraping source library" }],
  },
  twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" {...mantineHtmlProps} className={`${geistSans.variable} ${geistMono.variable} ${deckSans.variable} ${deckSerif.variable}`}>
      <body>
        <LeadelyProvider>{children}</LeadelyProvider>
      </body>
    </html>
  );
}
