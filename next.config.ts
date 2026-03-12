import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: new URL(process.env.SUPABASE_URL || "").hostname || "" },
    ],
  },

  /* config options here */
};

export default nextConfig;
