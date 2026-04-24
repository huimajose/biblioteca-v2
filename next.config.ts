import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useLightningcss: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
