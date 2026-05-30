"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ThemeApplier } from "@/components/ThemeApplier";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ThemeApplier />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{ unstyled: true, classNames: { toast: "" } }}
        gap={8}
      />
    </ThemeProvider>
  );
}
