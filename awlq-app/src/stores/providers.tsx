"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{ unstyled: true, classNames: { toast: "" } }}
        gap={8}
      />
    </ThemeProvider>
  );
}
