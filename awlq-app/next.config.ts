import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // In Docker, next build runs from /app/awlq-app. The monorepo root (/app)
    // holds the .bun/ content store that workspace node_modules symlinks point into.
    // Without this, Turbopack infers /app/ as workspace root but can't find next there.
    root: path.resolve(process.cwd(), ".."),
  },
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
