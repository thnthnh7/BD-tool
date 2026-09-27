import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isDevelopment = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "Content-Security-Policy", value: [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://*.stripe.com https://*.paypal.com https://*.sepay.vn",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://eewoirdimfpfborwdbzx.supabase.co https://*.stripe.com https://*.paypalobjects.com",
    "font-src 'self' data:",
    "connect-src 'self' https://eewoirdimfpfborwdbzx.supabase.co wss://eewoirdimfpfborwdbzx.supabase.co https://*.stripe.com https://*.paypal.com",
    "upgrade-insecure-requests",
  ].join("; ") },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eewoirdimfpfborwdbzx.supabase.co",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks", "@mantine/form", "@mantine/notifications"],
  },
};

export default withNextIntl(nextConfig);
