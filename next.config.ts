import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname || "" },
    ],
  },

  /* config options here */
};

export default nextConfig;
