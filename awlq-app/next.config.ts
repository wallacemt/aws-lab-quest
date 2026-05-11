import type { NextConfig } from "next";

function getSupabaseHostname(): string | null {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = getSupabaseHostname();

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31_536_000,
    remotePatterns: supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname }] : [],
  },
};

export default nextConfig;
