"use client";

import { useTheme } from "next-themes";
import { PixelButton } from "@/components/ui/PixelButton";

export function ThemeToggle({ className = "min-w-28" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  if (!theme) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <PixelButton
      variant="ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Alternar tema"
      className={className}
    >
      {isDark ? "Modo Claro" : "Modo Escuro"}
    </PixelButton>
  );
}
