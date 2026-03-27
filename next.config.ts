import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_SAFE_TOKENS_PER_MINUTE: process.env.GEMINI_SAFE_TOKENS_PER_MINUTE,
    GEMINI_MIN_CALL_INTERVAL_MS: process.env.GEMINI_MIN_CALL_INTERVAL_MS,

    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    APP_URL: process.env.APP_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    POLLINATIONS_API_KEY: process.env.POLLINATIONS_API_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_NAME: process.env.ADMIN_NAME,
    EMAIL_FROM: process.env.EMAIL_FROM,
    MAIL_USERNAME:process.env.MAIL_USERNAME,
    MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: new URL(process.env.SUPABASE_URL || "").hostname || "" }],
  },

  /* config options here */
};

export default nextConfig;
