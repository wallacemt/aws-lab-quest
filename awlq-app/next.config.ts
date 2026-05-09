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
    // SUPABASE_URL must be an ARG in the Dockerfile builder stage so this
    // domain is known at build time for Next.js image optimization.
    remotePatterns: supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname }] : [],
  },
};

export default nextConfig;
