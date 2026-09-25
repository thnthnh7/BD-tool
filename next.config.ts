import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
