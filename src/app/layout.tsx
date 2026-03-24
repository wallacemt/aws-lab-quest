import type { Metadata } from "next";
import { Nunito_Sans, Press_Start_2P, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/stores/providers";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "AWS Quest",
    template: "%s | AWS Quest",
  },
  description: "Gamificacao retro para laboratorios AWS com Gemini, quests, badges, historico e leaderboard.",
  applicationName: "AWS Quest",
  keywords: [
    "aws",
    "aws labs",
    "gamificacao",
    "cloud learning",
    "certificacao aws",
    "quest",
    "leaderboard",
    "badges",
    "retro learning",
    "gemini",
  ],
  authors: [{ name: "AWS  Quest Team" }],
  creator: "AWS  Quest",
  publisher: "AWS  Quest",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    title: "AWS Quest - Gamificacao Retro para Labs AWS",
    description: "Treine laboratorios AWS com quests tematicas, XP, badges e ranking.",
    siteName: "AWS Quest",
  },
  twitter: {
    card: "summary_large_image",
    title: "AWS Quest",
    description: "Estude AWS em formato de jogo com quests, XP e leaderboard.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/favicon.ico",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  category: "education",
  classification: "AWS Learning Gamification",
  referrer: "origin-when-cross-origin",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className={`${pixelFont.variable} ${bodyFont.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
