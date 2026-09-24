import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { mantineHtmlProps } from "@mantine/core";
import { LeadelyProvider } from "@/components/leadely-provider";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

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
  title: "Leadely",
  description: "AI BD assistant — quotes, slideshows and contracts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" {...mantineHtmlProps} className={`${geistSans.variable} ${geistMono.variable} ${deckSans.variable} ${deckSerif.variable}`}>
      <body>
        <LeadelyProvider>{children}</LeadelyProvider>
      </body>
    </html>
  );
}
