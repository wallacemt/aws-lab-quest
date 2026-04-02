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
  images: {
    remotePatterns: supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname }] : [],
  },

  /* config options here */
};

export default nextConfig;
