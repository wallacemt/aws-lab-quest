import type { Metadata } from "next";
import { Nunito_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  title: "AWS Lab Quest",
  description: "Gamificacao retro para laboratorios AWS com Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${pixelFont.variable} ${bodyFont.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
