import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose public Supabase vars to the browser (URL and anon key are not secrets).
  
  allowedDevOrigins: ["192.168.0.105", "127.0.0.1", "localhost", "http://localhost:3000"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
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
      // SocialLoginButtons pulls the Google/GitHub glyphs from devicon's CDN.
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  // LSF-2026-203: baseline security headers (no CSP nonce yet — tracked separately
  // since Next's nonce implementation had its own XSS advisory, GHSA-ffhc-5mcf-pf4q).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https://*.supabase.co https://cdn.jsdelivr.net",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              // https://*.supabase.co: PdfViewer embeds signed Storage URLs (PDF/SLIDES library content) in an <iframe>.
              "frame-src 'self' https://www.youtube.com https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
