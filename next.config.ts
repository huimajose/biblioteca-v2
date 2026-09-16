import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    useLightningcss: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
