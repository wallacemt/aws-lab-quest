import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    APP_URL: process.env.APP_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    POLLINATIONS_API_KEY: process.env.POLLINATIONS_API_KEY,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: new URL(process.env.SUPABASE_URL || "").hostname || "" }],
  },

  /* config options here */
};

export default nextConfig;
