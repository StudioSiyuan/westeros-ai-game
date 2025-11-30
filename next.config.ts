import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 忽略 TypeScript 报错
  typescript: {
    ignoreBuildErrors: true,
  },
  // 忽略 Eslint 报错
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;